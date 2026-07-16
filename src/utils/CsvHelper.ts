import fs from "fs";
import { parse } from 'csv-parse/sync';

export class CsvHelper {

    static readCsv(filePath: string): Record<string, string>[] {
        return parse(fs.readFileSync(filePath, "utf-8"), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
        }) as Record<string, string>[];
    }

    // Update a single cell in the CSV and write the file back.
    // rowIndex is 0-based (matches the array returned by readCsv).
    // Values containing commas, quotes, or newlines are quoted per RFC 4180.
    static updateRow(filePath: string, rowIndex: number, column: string, value: string): void {
        const rows = CsvHelper.readCsv(filePath);
        if (rowIndex < 0 || rowIndex >= rows.length) return;
        rows[rowIndex][column] = value;
        const headers = Object.keys(rows[0]);
        const escape = (v: string) =>
            /[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        const lines = [
            headers.join(','),
            ...rows.map(row => headers.map(h => escape(row[h] ?? '')).join(',')),
        ];
        fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
    }
}