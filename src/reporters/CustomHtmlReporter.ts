import type { Reporter, TestCase, TestResult, FullResult, FullConfig, Suite } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface TestRecord {
  id: string;
  module: string;
  specFile: string;
  description: string;
  payload: string;
  expectedResult: string;
  actualResult: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  errorLocation?: string;
  errorSnippetLine?: string;
  rawVideoPath?: string;
  videoPath?: string;
  rootCause?: string;
  timeoutLimit?: string;
  codeDefect?: string;
  recommendation?: string;
  consoleLogs: string[];
}

interface ModuleStat {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
}

interface ReporterOptions {
  outputDir?: string;
  suiteTitle?: string;
}

export default class CustomHtmlReporter implements Reporter {
  private records: TestRecord[] = [];
  private startTime!: Date;
  private outputDir: string;
  private suiteTitle: string;
  private moduleCounters = new Map<string, number>();
  private consoleByTest = new Map<TestCase, string[]>();
  private baseUrl = '';
  private browserName = 'chromium';
  private headless = true;
  private videoMode = 'off';

  constructor(options: ReporterOptions = {}) {
    this.outputDir = options.outputDir || 'reports/custom-report';
    this.suiteTitle = options.suiteTitle || 'Automation Suite';
  }

  onBegin(config: FullConfig, _suite: Suite) {
    this.startTime = new Date();
    this.baseUrl = process.env.BASE_URL || '';
    const project = config.projects?.[0];
    if (project) {
      this.browserName = project.name || (project.use as any)?.browserName || 'chromium';
      this.headless = (project.use as any)?.headless !== false;
      this.videoMode = String((project.use as any)?.video ?? 'off');
    }
  }

  onStdOut(chunk: string | Buffer, test: void | TestCase) {
    this.captureConsole(chunk, test);
  }

  onStdErr(chunk: string | Buffer, test: void | TestCase) {
    this.captureConsole(chunk, test);
  }

  private captureConsole(chunk: string | Buffer, test: void | TestCase) {
    if (!test) return;
    const lines = this.stripAnsi(chunk.toString()).split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const arr = this.consoleByTest.get(test) || [];
    arr.push(...lines);
    this.consoleByTest.set(test, arr);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const file = test.location.file;
    const fileName = path.basename(file, '.spec.ts');
    const moduleName = this.toModuleName(fileName);

    const count = (this.moduleCounters.get(moduleName) || 0) + 1;
    this.moduleCounters.set(moduleName, count);

    const prefix = moduleName.replace(/\s+/g, '').replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    const id = `${prefix}-${String(count).padStart(3, '0')}`;

    const status: 'passed' | 'failed' | 'skipped' =
      result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';

    let actualResult = '';
    let expectedResult = '--';
    let errorMessage = '';
    let errorLocation = '';
    let errorSnippetLine = '';
    let rootCause = '';
    let timeoutLimit = '--';
    let codeDefect = '';
    let recommendation = '';

    if (status === 'passed') {
      actualResult = 'Pass';
      expectedResult = 'Pass';
    } else if (status === 'failed' && result.error) {
      const msg = this.stripAnsi(result.error.message || result.error.value || 'Unknown error');
      errorMessage = msg;
      actualResult = msg.split('\n')[0].substring(0, 160);
      expectedResult = 'Pass';

      if (result.error.location) {
        errorLocation = `${this.relPath(result.error.location.file)}:${result.error.location.line}`;
      }
      if (result.error.snippet) {
        errorSnippetLine = this.extractSnippetLine(this.stripAnsi(result.error.snippet));
      }

      const c = this.classifyFailure(msg);
      rootCause = c.rootCause;
      timeoutLimit = c.timeoutLimit;
      codeDefect = c.codeDefect;
      recommendation = c.recommendation;
    } else if (status === 'skipped') {
      actualResult = 'Skipped';
    }

    const videoAtt = result.attachments.find(a => a.name === 'video' && a.path);
    const rawVideoPath = videoAtt?.path || '';

    const consoleLogs = this.consoleByTest.get(test) || [];
    this.consoleByTest.delete(test);

    this.records.push({
      id, module: moduleName, specFile: fileName, description: test.title, payload: '--', expectedResult, actualResult, status,
      duration: result.duration, errorMessage, errorLocation, errorSnippetLine, rawVideoPath,
      rootCause, timeoutLimit, codeDefect, recommendation, consoleLogs,
    });
  }

  async onEnd(_result: FullResult) {
    const durationMs = new Date().getTime() - this.startTime.getTime();

    const total = this.records.length;
    const passed = this.records.filter(r => r.status === 'passed').length;
    const failed = this.records.filter(r => r.status === 'failed').length;
    const skipped = this.records.filter(r => r.status === 'skipped').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    const moduleMap = new Map<string, ModuleStat>();
    for (const r of this.records) {
      if (!moduleMap.has(r.module)) moduleMap.set(r.module, { name: r.module, total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0 });
      const m = moduleMap.get(r.module)!;
      m.total++;
      m[r.status]++;
    }
    const modules: ModuleStat[] = Array.from(moduleMap.values()).map(m => ({ ...m, passRate: m.total > 0 ? (m.passed / m.total) * 100 : 0 }));

    const failures = this.records.filter(r => r.status === 'failed');

    this.cleanOutputDir(this.outputDir);

    // Copy failure video artifacts into the report folder so links resolve when the report is opened standalone.
    failures.forEach((f, i) => {
      if (f.rawVideoPath && fs.existsSync(f.rawVideoPath)) {
        f.videoPath = this.copyArtifact(f.rawVideoPath, this.outputDir, i);
      }
    });

    const html = this.buildHtml({ total, passed, failed, skipped, passRate, durationMs, modules, records: this.records, failures });

    const outputFile = path.join(this.outputDir, `${this.buildFileName()}.html`);
    fs.writeFileSync(outputFile, html, 'utf-8');
    console.log(`\n  Custom HTML Report → ${path.resolve(outputFile)}`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private toModuleName(fileName: string): string {
    return fileName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}m ${s % 60}s`;
    if (s > 0) return `${s}s`;
    return `${ms}ms`;
  }

  private formatDate(d: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private formatTime(d: Date): string {
    return d.toTimeString().split(' ')[0];
  }

  private barColor(pct: number): string {
    if (pct >= 90) return '#22c55e';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  private capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  private hostOf(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  private stripAnsi(s: string): string {
    return (s || '').replace(/\x1b\[[0-9;]*m/g, '');
  }

  private relPath(p: string): string {
    return path.relative(process.cwd(), p).replace(/\\/g, '/');
  }

  private extractSnippetLine(snippet: string): string {
    const lines = snippet.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*>\s*\d+\s*\|\s?(.*)$/);
      if (m && m[1].trim()) return m[1].trim();
    }
    for (const line of lines) {
      const m = line.match(/^\s*\d+\s*\|\s?(.*)$/);
      if (m && m[1].trim()) return m[1].trim();
    }
    return '';
  }

  private classifyFailure(message: string): { rootCause: string; timeoutLimit: string; codeDefect: string; recommendation: string } {
    const lower = (message || '').toLowerCase();
    const msMatch = message.match(/(\d[\d,]*)\s?ms/);
    const timeoutLimit = msMatch ? `${msMatch[1].replace(/,/g, '')} ms` : '--';

    if (lower.includes('timeout')) {
      const isNav = lower.includes('goto') || lower.includes('navigation');
      return {
        rootCause: isNav ? 'Server Timeout' : 'UI Timeout',
        timeoutLimit,
        codeDefect: 'No',
        recommendation: 'Retry / Increase Timeout',
      };
    }
    if (lower.includes('strict mode violation') || lower.includes('resolved to')) {
      return { rootCause: 'Locator Ambiguity', timeoutLimit: '--', codeDefect: 'Yes', recommendation: 'Refine Selector' };
    }
    if (lower.includes('net::') || lower.includes('econnrefused') || lower.includes('econnreset')) {
      return { rootCause: 'Network Error', timeoutLimit: '--', codeDefect: 'No', recommendation: 'Check Network / Environment' };
    }
    if (lower.includes('expect(') || (lower.includes('expected') && lower.includes('received'))) {
      return { rootCause: 'Assertion Mismatch', timeoutLimit: '--', codeDefect: 'Possible', recommendation: 'Review Expected vs Actual' };
    }
    return { rootCause: 'Unhandled Exception', timeoutLimit: '--', codeDefect: 'Possible', recommendation: 'Investigate Stack Trace' };
  }

  private cleanOutputDir(dir: string) {
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir)) {
        try {
          fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
        } catch (e) {
          console.warn(`  Could not remove ${path.join(dir, entry)}: ${(e as Error).message}`);
        }
      }
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private copyArtifact(srcPath: string, outputDir: string, index: number): string {
    try {
      const artifactsDir = path.join(outputDir, 'artifacts');
      if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
      const destName = `f${index}_${path.basename(srcPath)}`;
      fs.copyFileSync(srcPath, path.join(artifactsDir, destName));
      return `artifacts/${destName}`;
    } catch {
      return '';
    }
  }

  private buildFileName(): string {
    const specFiles = Array.from(new Set(this.records.map(r => r.specFile))).filter(Boolean);
    let base: string;
    if (specFiles.length === 1) {
      base = specFiles[0];
    } else if (specFiles.length > 1 && specFiles.length <= 4) {
      base = specFiles.join('_');
    } else {
      base = this.suiteTitle || 'Automation-Report';
    }
    return base.replace(/[^A-Za-z0-9_-]+/g, '_');
  }

  private esc(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Flags a console line as a failure (red) or success (green) so problems jump out visually
  // when scanning a test's full output, instead of reading every line to spot what went wrong.
  private static readonly CONSOLE_FAIL_PATTERN = /✗|MISMATCH|not visible|not opened|wrong (site|url|title)|no favicon|\binsane\b|out of range|outside ±/i;
  private static readonly CONSOLE_OK_PATTERN   = /✓|\bOK\b|\bsane\b|in range|within ±|has favicon|correct (site|title|url)|\bopened\b/i;

  private colorizeConsoleLine(line: string): string {
    const esc = this.esc(line);
    if (CustomHtmlReporter.CONSOLE_FAIL_PATTERN.test(line)) return `<span class="console-fail">${esc}</span>`;
    if (CustomHtmlReporter.CONSOLE_OK_PATTERN.test(line))   return `<span class="console-ok">${esc}</span>`;
    return esc;
  }

  // ── HTML builder ──────────────────────────────────────────────────────────

  private buildHtml(data: {
    total: number; passed: number; failed: number; skipped: number; passRate: string;
    durationMs: number; modules: ModuleStat[]; records: TestRecord[]; failures: TestRecord[];
  }): string {
    const { total, passed, failed, skipped, passRate, durationMs, modules, records, failures } = data;
    const statusOk = failed === 0;
    const statusLabel = statusOk ? 'All Tests Passed' : 'Needs Attention';
    const statusColor = statusOk ? '#22c55e' : '#f59e0b';
    const statusIcon = statusOk ? '✓' : '⚠';

    const browserLabel = `${this.capitalize(this.browserName)} (${this.headless ? 'headless' : 'headed'})`;
    const videoLabel = this.videoMode && this.videoMode !== 'off' ? 'enabled' : 'disabled';

    /* ── sidebar module list ── */
    const sidebarModules = modules.map(m => `
      <li class="mod-item" data-module="${this.esc(m.name)}" onclick="filterByModule('${this.esc(m.name)}')">
        ${this.esc(m.name)}
      </li>`).join('');

    /* ── group performance rows ── */
    const perfRows = modules.map(m => {
      const c = this.barColor(m.passRate);
      return `
      <div class="perf-row">
        <span class="perf-name" title="${this.esc(m.name)}">${this.esc(m.name)}</span>
        <div class="perf-bar-wrap"><div class="perf-bar" style="width:${m.passRate.toFixed(1)}%;background:${c};"></div></div>
        <span class="perf-pct" style="color:${c};">${Math.round(m.passRate)}%</span>
      </div>`;
    }).join('');

    /* ── failure + analysis blocks ── */
    const failureBlocks = failures.slice(0, 5).map(f => {
      const lines = (f.errorMessage || '').split('\n').filter(l => l.trim()).slice(0, 2);
      const locLine = f.errorLocation
        ? `at ${f.errorLocation}${f.errorSnippetLine ? ' — ' + f.errorSnippetLine : ''}`
        : '';
      return `
      <div class="fail-card">
        <div class="fail-item">
          <div class="fail-body">
            <div class="fail-title">${this.esc(f.description)}</div>
            ${lines.map(l => `<div class="fail-err">${this.esc(l)}</div>`).join('')}
            ${locLine ? `<div class="fail-loc">${this.esc(locLine)}</div>` : ''}
          </div>
          <span class="fail-tag">${this.esc(f.module.toUpperCase())}</span>
        </div>
        <div class="analysis-box">
          <div class="analysis-title">Failure Analysis</div>
          <div class="analysis-row"><span>Root Cause</span><strong class="ac-warn">${this.esc(f.rootCause || '--')}</strong></div>
          <div class="analysis-row"><span>Timeout Limit</span><strong>${this.esc(f.timeoutLimit || '--')}</strong></div>
          <div class="analysis-row"><span>Code Defect</span><strong class="${f.codeDefect === 'No' ? 'ac-ok' : 'ac-warn'}">${this.esc(f.codeDefect || '--')}</strong></div>
          <div class="analysis-row"><span>Recommendation</span><strong class="ac-link">${this.esc(f.recommendation || '--')}</strong></div>
          ${f.videoPath ? `<div class="analysis-row"><span>Video Artifact</span><strong class="ac-link"><a href="${this.esc(f.videoPath)}" target="_blank">${this.esc(f.videoPath)}</a></strong></div>` : ''}
        </div>
      </div>`;
    }).join('');
    const moreLabel = failures.length > 5 ? `<div class="more-label">...and ${failures.length - 5} more</div>` : '';

    /* ── table rows ── */
    const tableRows = records.map((r, idx) => {
      const sc = r.status === 'passed' ? 'badge-pass' : r.status === 'skipped' ? 'badge-skip' : 'badge-fail';
      const st = r.status === 'passed' ? 'PASS' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
      const dur = r.duration < 1000 ? `${r.duration}ms` : `${(r.duration / 1000).toFixed(2)}s`;

      const errLoc = r.errorLocation
        ? `at ${r.errorLocation}${r.errorSnippetLine ? ' — ' + r.errorSnippetLine : ''}`
        : '';
      const errorSection = r.errorMessage
        ? `<div class="detail-sec">
             <div class="detail-lbl">Error</div>
             <div class="detail-err">${this.esc(r.errorMessage)}</div>
             ${errLoc ? `<div class="detail-loc">${this.esc(errLoc)}</div>` : ''}
           </div>`
        : '';
      const consoleText = r.consoleLogs.length
        ? r.consoleLogs.map(l => this.colorizeConsoleLine(l)).join('\n')
        : '(no console output captured for this test)';
      const videoSection = r.videoPath
        ? `<div class="detail-sec"><a class="detail-video" href="${this.esc(r.videoPath)}" target="_blank">&#9654; View Failure Video</a></div>`
        : '';

      return `
      <tr class="trow" data-module="${this.esc(r.module)}" data-status="${r.status}" data-idx="${idx}" onclick="toggleDetail(${idx})">
        <td class="c-id"><span class="chev" id="chev-${idx}">&#9656;</span>${this.esc(r.id)}</td>
        <td class="c-mod">${this.esc(r.module)}</td>
        <td class="c-desc">${this.esc(r.description)}</td>
        <td class="c-pl">${this.esc(r.payload)}</td>
        <td class="c-exp">${this.esc(r.expectedResult)}</td>
        <td class="c-act${r.status === 'failed' ? ' c-act-fail' : ''}">${this.esc(r.actualResult)}</td>
        <td class="c-st"><span class="badge ${sc}">${st}</span></td>
        <td class="c-dur">${dur}</td>
      </tr>
      <tr class="trow-detail" id="detail-${idx}" data-module="${this.esc(r.module)}" data-status="${r.status}" style="display:none">
        <td colspan="8">
          <div class="detail-box">
            ${errorSection}
            <div class="detail-sec">
              <div class="detail-lbl">Console Output</div>
              <pre class="detail-console">${consoleText}</pre>
            </div>
            ${videoSection}
          </div>
        </td>
      </tr>`;
    }).join('');

    /* ── group filter options ── */
    const moduleOptions = modules.map(m => `<option value="${this.esc(m.name)}">${this.esc(m.name)}</option>`).join('');

    /* ── key findings bar ── */
    const findingsBar = statusOk
      ? `<div class="findings ok-findings">
           <span class="findings-text"><strong>Key Findings</strong>&nbsp;&nbsp;All tests passed &bull; Total duration: ${this.formatDuration(durationMs)} &bull; Browser: ${browserLabel} &bull; Video: ${videoLabel}</span>
           <span class="findings-badge ok-badge">✓ All Passed</span>
         </div>`
      : `<div class="findings warn-findings">
           <span class="findings-text"><strong>Key Findings</strong>&nbsp;&nbsp;${failed} failure${failed !== 1 ? 's' : ''} detected &bull; Total duration: ${this.formatDuration(durationMs)} &bull; Browser: ${browserLabel} &bull; Video: ${videoLabel}</span>
           <span class="findings-badge warn-badge">⚠ Needs Attention</span>
         </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Test Execution Report</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0e1a;color:#e2e8f0;display:flex;min-height:100vh;font-size:13px}

/* ── Sidebar ── */
.sidebar{width:205px;min-width:205px;background:#0d1321;border-right:1px solid #1e293b;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:10}
.sb-brand{padding:20px 16px 16px;border-bottom:1px solid #1e293b}
.sb-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;font-weight:600;margin-bottom:4px}
.sb-app{font-size:14px;font-weight:700;color:#f1f5f9}
.sb-sub{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.sb-sec{padding:12px 16px;border-bottom:1px solid #1e293b}
.sb-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;margin-bottom:8px;font-weight:600}
.sb-row{display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px}
.sb-k{color:#64748b}.sb-v{color:#94a3b8;font-weight:500}
.sb-env-link{color:#60a5fa;font-size:12px;text-decoration:none;word-break:break-all}
.sb-env-link:hover{text-decoration:underline}
.sb-status{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600}
.sb-dot{width:8px;height:8px;border-radius:50%}
.mod-list{list-style:none;padding:8px 0}
.mod-item{padding:7px 16px;font-size:12px;color:#94a3b8;cursor:pointer;transition:background .15s,color .15s;border-left:2px solid transparent}
.mod-item:hover,.mod-item.active{background:#1e293b;color:#f1f5f9;border-left-color:#3b82f6}
.mod-all{color:#60a5fa;font-weight:600;border-left-color:#3b82f6;background:#1e293b22}

/* ── Main ── */
.main{margin-left:205px;flex:1;padding:24px;overflow-x:hidden}
.pg-header{margin-bottom:20px}
.pg-title{font-size:22px;font-weight:700;color:#f1f5f9}
.pg-sub{font-size:12px;color:#64748b;margin-top:4px}

/* ── Stat cards ── */
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px}
.card{border-radius:8px;padding:16px 18px 12px;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 8px 8px;opacity:.8}
.c-total{background:linear-gradient(135deg,#1e3a8a,#1d4ed8)}.c-total::after{background:#60a5fa}
.c-pass {background:linear-gradient(135deg,#064e3b,#047857)}.c-pass::after {background:#34d399}
.c-fail {background:linear-gradient(135deg,#7c2d12,#c2410c)}.c-fail::after {background:#fb923c}
.c-skip {background:linear-gradient(135deg,#713f12,#b45309)}.c-skip::after {background:#fbbf24}
.c-rate {background:linear-gradient(135deg,#4c1d95,#6d28d9)}.c-rate::after {background:#a78bfa}
.card-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.65);font-weight:600;margin-bottom:8px}
.card-val{font-size:32px;font-weight:700;color:#fff;line-height:1}
.card-bar{height:3px;background:rgba(255,255,255,.15);border-radius:2px;margin-top:12px}
.card-bar-fill{height:100%;border-radius:2px;background:rgba(255,255,255,.5)}

/* ── Findings bar ── */
.findings{border-radius:6px;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:12px;border:1px solid}
.warn-findings{background:#1a1f2e;border-color:#1e293b;border-left:3px solid #f59e0b}
.ok-findings  {background:#0d1f14;border-color:#1e293b;border-left:3px solid #22c55e}
.findings-text{color:#94a3b8}
.findings-badge{border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;border:1px solid;white-space:nowrap}
.warn-badge{background:#f59e0b22;color:#f59e0b;border-color:#f59e0b44}
.ok-badge  {background:#22c55e22;color:#22c55e;border-color:#22c55e44}

/* ── Two-col ── */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;align-items:start}
.panel{background:#111827;border:1px solid #1e293b;border-radius:8px;overflow:hidden}
.panel-head{padding:14px 16px 10px;border-bottom:1px solid #1e293b;font-size:13px;font-weight:600;color:#e2e8f0}
.panel-sub{font-size:11px;color:#64748b;font-weight:400;margin-top:2px}
.panel-body{padding:12px 16px}

/* ── Group perf ── */
.perf-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.perf-name{width:145px;min-width:145px;font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.perf-bar-wrap{flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden}
.perf-bar{height:100%;border-radius:3px}
.perf-pct{width:38px;min-width:38px;font-size:11px;font-weight:600;text-align:right}

/* ── Failure list ── */
.fail-card{margin-bottom:12px}
.fail-item{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;background:#1a0f0a;border:1px solid #7c2d1244;border-left:3px solid #ef4444;border-radius:6px 6px 0 0;gap:8px}
.fail-body{flex:1;min-width:0}
.fail-title{font-size:12px;font-weight:600;color:#fca5a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fail-err{font-size:11px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fail-loc{font-size:10px;font-family:monospace;color:#64748b;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fail-tag{background:#3b82f622;color:#60a5fa;border:1px solid #3b82f644;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0}
.more-label{text-align:center;color:#64748b;font-size:11px;padding:8px;font-style:italic}
.no-fail{text-align:center;color:#475569;font-size:12px;padding:24px}

/* ── Failure analysis box ── */
.analysis-box{background:#0d1321;border:1px solid #1e293b;border-top:none;border-radius:0 0 6px 6px;padding:10px 12px}
.analysis-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;font-weight:600;margin-bottom:8px}
.analysis-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:11px;border-bottom:1px solid #0f172a}
.analysis-row:last-child{border-bottom:none}
.analysis-row span{color:#64748b}
.analysis-row strong{font-weight:600;color:#cbd5e1;max-width:60%;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.analysis-row a{color:inherit;text-decoration:none}
.analysis-row a:hover{text-decoration:underline}
.ac-warn{color:#f59e0b !important}
.ac-ok{color:#22c55e !important}
.ac-link{color:#60a5fa !important}

/* ── Table ── */
.tbl-panel{background:#111827;border:1px solid #1e293b;border-radius:8px;overflow:hidden;margin-bottom:24px}
.tbl-toolbar{padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.tbl-title{font-size:13px;font-weight:600;color:#e2e8f0;flex:1}
.tbl-count{font-size:11px;color:#64748b;background:#1e293b;padding:2px 8px;border-radius:10px}
.search{background:#1e293b;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:6px 12px;font-size:12px;outline:none;width:240px}
.search:focus{border-color:#3b82f6}
.search::placeholder{color:#475569}
.fsel{background:#1e293b;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:6px 12px;font-size:12px;outline:none;cursor:pointer}
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{background:#0d1321;padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#475569;font-weight:600;border-bottom:1px solid #1e293b;white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid #0f172a;vertical-align:middle;font-size:12px;color:#94a3b8}
tr:hover td{background:#1e293b22}
.trow{cursor:pointer}
.trow-detail td{background:#0a0e1a;padding:0;border-bottom:1px solid #1e293b}
.trow-detail:hover td{background:#0a0e1a}
.chev{display:inline-block;width:12px;color:#475569;font-size:9px}
.c-id {color:#60a5fa;font-weight:600;font-family:monospace;font-size:11px}
.c-mod{color:#a78bfa;font-weight:500}
.c-desc{color:#cbd5e1;max-width:280px}
.c-act{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.c-act-fail{color:#f87171;font-weight:600}
.c-dur{text-align:right;font-family:monospace;font-size:11px}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:.5px;border:1px solid}
.badge-pass{background:#052e1655;color:#22c55e;border-color:#22c55e44}
.badge-fail{background:#450a0a55;color:#ef4444;border-color:#ef444444}
.badge-skip{background:#1c1c0055;color:#a3a31a;border-color:#a3a31a44}
.empty-row td{text-align:center;padding:40px;color:#475569;font-size:13px}

/* ── Row detail (expand) ── */
.detail-box{padding:14px 20px 16px 42px;display:flex;flex-direction:column;gap:12px}
.detail-sec{display:flex;flex-direction:column;gap:4px}
.detail-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;font-weight:600}
.detail-err{font-size:12px;color:#fca5a5;white-space:pre-wrap;word-break:break-word}
.detail-loc{font-size:11px;font-family:monospace;color:#64748b}
.detail-console{background:#0d1321;border:1px solid #1e293b;border-radius:6px;padding:10px 12px;font-family:monospace;font-size:11px;line-height:1.6;color:#94a3b8;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow-y:auto;margin:0}
.console-fail{color:#f87171;font-weight:600}
.console-ok{color:#4ade80}
.detail-video{color:#60a5fa;font-size:12px;text-decoration:none;font-weight:600}
.detail-video:hover{text-decoration:underline}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#0d1321}
::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#475569}
</style>
</head>
<body>

<!-- Sidebar -->
<aside class="sidebar">
  <div class="sb-brand">
    <div class="sb-eyebrow">Report</div>
    <div class="sb-app">${this.esc(this.suiteTitle)}</div>
    <div class="sb-sub">Automation Report</div>
  </div>
  ${this.baseUrl ? `
  <div class="sb-sec">
    <div class="sb-lbl">Environment</div>
    <a class="sb-env-link" href="${this.esc(this.baseUrl)}" target="_blank" rel="noopener">${this.esc(this.hostOf(this.baseUrl))}</a>
  </div>` : ''}
  <div class="sb-sec">
    <div class="sb-lbl">Generated</div>
    <div class="sb-row"><span class="sb-k">Date</span><span class="sb-v">${this.formatDate(this.startTime)}</span></div>
    <div class="sb-row"><span class="sb-k">Time</span><span class="sb-v">${this.formatTime(this.startTime)}</span></div>
    <div class="sb-row"><span class="sb-k">Duration</span><span class="sb-v">${this.formatDuration(durationMs)}</span></div>
    <div class="sb-row"><span class="sb-k">Tests</span><span class="sb-v">${total}</span></div>
  </div>
  <div class="sb-sec">
    <div class="sb-lbl">Status</div>
    <div class="sb-status">
      <div class="sb-dot" style="background:${statusColor};box-shadow:0 0 6px ${statusColor}55;"></div>
      <span style="color:${statusColor};">${statusIcon} ${statusLabel}</span>
    </div>
  </div>
  <div class="sb-sec">
    <div class="sb-lbl">Test Groups</div>
    <ul class="mod-list">
      <li class="mod-item mod-all active" onclick="filterByModule('all')">All Tests</li>
      ${sidebarModules}
    </ul>
  </div>
</aside>

<!-- Main content -->
<main class="main">

  <div class="pg-header">
    <div class="pg-title">Test Execution Report</div>
    <div class="pg-sub">Playwright &middot; ${this.esc(this.suiteTitle)} &middot; Run: ${this.formatDate(this.startTime)}</div>
  </div>

  <!-- Stats row -->
  <div class="stats">
    <div class="card c-total">
      <div class="card-lbl">Total Tests</div>
      <div class="card-val">${total}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:100%"></div></div>
    </div>
    <div class="card c-pass">
      <div class="card-lbl">Passed</div>
      <div class="card-val">${passed}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%"></div></div>
    </div>
    <div class="card c-fail">
      <div class="card-lbl">Failed</div>
      <div class="card-val">${failed}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%"></div></div>
    </div>
    <div class="card c-skip">
      <div class="card-lbl">Skipped</div>
      <div class="card-val">${skipped}</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${total > 0 ? ((skipped / total) * 100).toFixed(1) : 0}%"></div></div>
    </div>
    <div class="card c-rate">
      <div class="card-lbl">Pass Rate</div>
      <div class="card-val">${passRate}%</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:${passRate}%"></div></div>
    </div>
  </div>

  <!-- Key findings -->
  ${findingsBar}

  <!-- Two-column: Performance + Failures -->
  <div class="two-col">
    <div class="panel">
      <div class="panel-head">Group Performance<div class="panel-sub">Pass rate by test group</div></div>
      <div class="panel-body">${perfRows || '<div class="no-fail">No group data</div>'}</div>
    </div>
    <div class="panel">
      <div class="panel-head">Failure Breakdown<div class="panel-sub">${failures.length === 0 ? 'All tests passed' : `${failures.length} failure${failures.length !== 1 ? 's' : ''} requiring attention`}</div></div>
      <div class="panel-body">
        ${failures.length === 0
          ? '<div class="no-fail">No failures detected</div>'
          : failureBlocks + moreLabel}
      </div>
    </div>
  </div>

  <!-- Test cases table -->
  <div class="tbl-panel">
    <div class="tbl-toolbar">
      <span class="tbl-title">Test Cases</span>
      <span class="tbl-count" id="visCount">${total} total</span>
      <input class="search" id="searchIn" type="text" placeholder="Search by description, result, status..." oninput="applyFilters()">
      <select class="fsel" id="stFilter" onchange="applyFilters()">
        <option value="all">All Statuses</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
      </select>
      <select class="fsel" id="modFilter" onchange="syncSidebarFromSelect(); applyFilters()">
        <option value="all">All Test Groups</option>
        ${moduleOptions}
      </select>
    </div>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Test Group</th><th>Description</th><th>Payload</th>
            <th>Expected Result</th><th>Actual Result</th><th>Status</th><th>Duration</th>
          </tr>
        </thead>
        <tbody id="tbody">
          ${tableRows || '<tr class="empty-row"><td colspan="8">No test data available</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

</main>

<script>
  var TOTAL = ${total};

  function applyFilters() {
    var search = document.getElementById('searchIn').value.toLowerCase();
    var stF    = document.getElementById('stFilter').value;
    var modF   = document.getElementById('modFilter').value;
    var rows   = document.querySelectorAll('#tbody tr.trow');
    var vis    = 0;

    rows.forEach(function(row) {
      var mod  = row.dataset.module;
      var stat = row.dataset.status;
      var txt  = row.textContent.toLowerCase();

      var ok = (modF === 'all' || mod === modF)
            && (stF  === 'all' || stat === stF)
            && (!search || txt.includes(search));

      row.style.display = ok ? '' : 'none';
      if (ok) vis++;

      if (!ok) {
        var det = document.getElementById('detail-' + row.dataset.idx);
        if (det) det.style.display = 'none';
        var chev = document.getElementById('chev-' + row.dataset.idx);
        if (chev) chev.innerHTML = '&#9656;';
      }
    });

    document.getElementById('visCount').textContent = vis + ' of ' + TOTAL;
  }

  function toggleDetail(idx) {
    var det = document.getElementById('detail-' + idx);
    var chev = document.getElementById('chev-' + idx);
    if (!det) return;
    var show = det.style.display === 'none';
    det.style.display = show ? 'table-row' : 'none';
    if (chev) chev.innerHTML = show ? '&#9662;' : '&#9656;';
  }

  function filterByModule(mod) {
    document.querySelectorAll('.mod-item').forEach(function(el) { el.classList.remove('active'); });
    var target = mod === 'all'
      ? document.querySelector('.mod-all')
      : Array.from(document.querySelectorAll('.mod-item[data-module]')).find(function(el) { return el.dataset.module === mod; });
    if (target) target.classList.add('active');

    document.getElementById('modFilter').value = mod;
    applyFilters();
  }

  function syncSidebarFromSelect() {
    var val = document.getElementById('modFilter').value;
    filterByModule(val);
  }
</script>
</body>
</html>`;
  }
}
