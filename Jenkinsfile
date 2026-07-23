// ═══════════════════════════════════════════════════════════════
// Jenkinsfile — Master CI/CD Pipeline (Docker)
// Playwright TypeScript Framework
// Tests run inside Docker containers
// Naveen Automation Labs
// ═══════════════════════════════════════════════════════════════

pipeline {
    agent any

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['QA', 'dev', 'stage', 'Prod'],
            description: 'Select environment to run tests'
        )
        choice(
            name: 'BROWSER',
            choices: ['chromium', 'firefox', 'webkit'],
            description: 'Select browser'
        )
        choice(
            name: 'TEST_SUITE',
            choices: ['all', 'smoke', 'regression', 'api-smoke'],
            description: 'Select test suite'
        )
    }

    environment {
        SLACK_CHANNEL  = '#general'
        DOCKER_IMAGE   = 'pw-framework'
    }

    options {
        timeout(time: 50, unit: 'MINUTES')
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    stages {

        // ═════════════════════════════════════════════════
        // STAGE 1: BUILD DOCKER IMAGE
        // ═════════════════════════════════════════════════
        stage('Build Docker Image') {
            steps {
                echo "========================================="
                echo "  Building Playwright Docker Image"
                echo "========================================="
                bat "docker build -t ${DOCKER_IMAGE} ."
                bat "docker images | findstr ${DOCKER_IMAGE}"
            }
        }

        // ═════════════════════════════════════════════════
        // STAGE 2: DEPLOY DEV + SANITY
        // ═════════════════════════════════════════════════
        stage('Deploy to DEV') {
            steps {
                echo "Deploying to DEV... ✅"
            }
        }

        stage('DEV - Sanity Tests') {
            steps {
                echo "========================================="
                echo "  Running SANITY @smoke on DEV (Docker)"
                echo "========================================="
                bat 'if not exist reports-dev\\html mkdir reports-dev\\html'
                bat 'if not exist allure-results-dev mkdir allure-results-dev'
                withCredentials([
                    usernamePassword(credentialsId: 'dev-credentials', usernameVariable: 'EMAIL', passwordVariable: 'PASSWORD'),
                    string(credentialsId: 'app-static-otp', variable: 'OTP')
                ]) {
                    bat '''
                        docker run --rm ^
                            -e CI=true ^
                            -e ENV=dev ^
                            -e BASE_URL=https://stage-exchange.knooz.com ^
                            -e EMAIL=%EMAIL% ^
                            -e PASSWORD=%PASSWORD% ^
                            -e OTP=%OTP% ^
                            -v "%WORKSPACE%/reports-dev/html:/app/reports/html-report" ^
                            -v "%WORKSPACE%/allure-results-dev:/app/allure-results" ^
                            %DOCKER_IMAGE% ^
                            npx playwright test --project=chromium --grep @smoke
                    '''
                }
            }
            post {
                always {
                    bat 'if not exist reports-dev\\allure mkdir reports-dev\\allure'
                    bat 'npx allure generate allure-results-dev --clean -o reports-dev/allure || ver>nul'
                    publishHTML(target: [
                        reportName: 'DEV Sanity - PW HTML Report',
                        reportDir: 'reports-dev/html',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true,
                        allowMissing: true
                    ])
                    publishHTML(target: [
                        reportName: 'DEV Sanity - Allure Report',
                        reportDir: 'reports-dev/allure',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true,
                        allowMissing: true
                    ])
                }
            }
        }

        // ═════════════════════════════════════════════════
        // STAGE 3: DEPLOY QA + REGRESSION
        // ═════════════════════════════════════════════════
        stage('Deploy to QA') {
            steps {
                echo "Deploying to QA... ✅"
            }
        }

        stage('QA - Regression Tests') {
            steps {
                echo "========================================="
                echo "  Running REGRESSION on QA (Docker)"
                echo "========================================="
                bat 'if not exist reports-qa\\html mkdir reports-qa\\html'
                bat 'if not exist allure-results-qa mkdir allure-results-qa'
                withCredentials([
                    usernamePassword(credentialsId: 'qa-credentials', usernameVariable: 'EMAIL', passwordVariable: 'PASSWORD'),
                    string(credentialsId: 'app-static-otp', variable: 'OTP')
                ]) {
                    bat '''
                        docker run --rm ^
                            -e CI=true ^
                            -e ENV=qa ^
                            -e BASE_URL=https://stage-exchange.knooz.com ^
                            -e EMAIL=%EMAIL% ^
                            -e PASSWORD=%PASSWORD% ^
                            -e OTP=%OTP% ^
                            -v "%WORKSPACE%/reports-qa/html:/app/reports/html-report" ^
                            -v "%WORKSPACE%/allure-results-qa:/app/allure-results" ^
                            %DOCKER_IMAGE% ^
                            npx playwright test --project=chromium --grep @smoke
                    '''
                }
            }
            post {
                always {
                    bat 'if not exist reports-qa\\allure mkdir reports-qa\\allure'
                    bat 'npx allure generate allure-results-qa --clean -o reports-qa/allure || ver>nul'
                    publishHTML(target: [
                        reportName: 'QA Regression - PW HTML Report',
                        reportDir: 'reports-qa/html',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                    publishHTML(target: [
                        reportName: 'QA Regression - Allure Report',
                        reportDir: 'reports-qa/allure',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                }
            }
        }

        // ═════════════════════════════════════════════════
        // STAGE 4: DEPLOY STAGE + SANITY
        // ═════════════════════════════════════════════════
        stage('Deploy to STAGE') {
            steps {
                echo "Deploying to STAGE... ✅"
            }
        }

        stage('STAGE - Sanity Tests') {
            steps {
                echo "========================================="
                echo "  Running SANITY @smoke on STAGE (Docker)"
                echo "========================================="
                bat 'if not exist reports-stage\\html mkdir reports-stage\\html'
                bat 'if not exist allure-results-stage mkdir allure-results-stage'
                withCredentials([
                    usernamePassword(credentialsId: 'stage-credentials', usernameVariable: 'EMAIL', passwordVariable: 'PASSWORD'),
                    string(credentialsId: 'app-static-otp', variable: 'OTP'),
                    string(credentialsId: 'app-totp-secret', variable: 'TRADE_2FA_SECRET')
                ]) {
                    bat '''
                        docker run --rm ^
                            -e CI=true ^
                            -e ENV=stage ^
                            -e BASE_URL=https://stage-exchange.knooz.com ^
                            -e EMAIL=%EMAIL% ^
                            -e PASSWORD=%PASSWORD% ^
                            -e OTP=%OTP% ^
                            -e TRADE_BASE_URL=https://stage-exchange.knooz.com ^
                            -e TRADE_USER_EMAIL=%EMAIL% ^
                            -e TRADE_USER_PASSWORD=%PASSWORD% ^
                            -e TRADE_2FA_SECRET=%TRADE_2FA_SECRET% ^
                            -e TRADE_BUY_MARKET=btcusdt ^
                            -e TRADE_BUY_VOLUME=0.0001 ^
                            -e TRADE_BUY_PRICE=62500 ^
                            -e TRADE_SELL_MARKET=btcusdt ^
                            -e TRADE_SELL_VOLUME=0.0001 ^
                            -e TRADE_SELL_PRICE=85000 ^
                            -v "%WORKSPACE%/reports-stage/html:/app/reports/html-report" ^
                            -v "%WORKSPACE%/allure-results-stage:/app/allure-results" ^
                            %DOCKER_IMAGE% ^
                            npx playwright test --project=chromium --grep @sanity
                    '''
                }
            }
            post {
                always {
                    bat 'if not exist reports-stage\\allure mkdir reports-stage\\allure'
                    bat 'npx allure generate allure-results-stage --clean -o reports-stage/allure || ver>nul'
                    publishHTML(target: [
                        reportName: 'STAGE Sanity - PW HTML Report',
                        reportDir: 'reports-stage/html',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                    publishHTML(target: [
                        reportName: 'STAGE Sanity - Allure Report',
                        reportDir: 'reports-stage/allure',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                }
            }
        }

        // ═════════════════════════════════════════════════
        // STAGE 5: DEPLOY PROD + SMOKE (with approval)
        // ═════════════════════════════════════════════════
        stage('Approval for PROD') {
            steps {
                input message: 'Deploy to PROD?',
                    ok: 'Yes, Deploy!',
                    submitter: 'admin,naveen'
            }
        }

        stage('Deploy to PROD') {
            steps {
                echo "Deploying to PROD... ✅"
            }
        }

        stage('PROD - Smoke Tests') {
            steps {
                echo "========================================="
                echo "  Running SMOKE @smoke on PROD (Docker)"
                echo "========================================="
                bat 'if not exist reports-prod\\html mkdir reports-prod\\html'
                bat 'if not exist allure-results-prod mkdir allure-results-prod'
                withCredentials([
                    usernamePassword(credentialsId: 'prod-credentials', usernameVariable: 'EMAIL', passwordVariable: 'PASSWORD'),
                    string(credentialsId: 'app-static-otp', variable: 'OTP')
                ]) {
                    bat '''
                        docker run --rm ^
                            -e CI=true ^
                            -e ENV=prod ^
                            -e BASE_URL=https://stage-exchange.knooz.com ^
                            -e EMAIL=%EMAIL% ^
                            -e PASSWORD=%PASSWORD% ^
                            -e OTP=%OTP% ^
                            -v "%WORKSPACE%/reports-prod/html:/app/reports/html-report" ^
                            -v "%WORKSPACE%/allure-results-prod:/app/allure-results" ^
                            %DOCKER_IMAGE% ^
                            npx playwright test --project=chromium --grep @smoke
                    '''
                }
            }
            post {
                always {
                    bat 'if not exist reports-prod\\allure mkdir reports-prod\\allure'
                    bat 'npx allure generate allure-results-prod --clean -o reports-prod/allure || ver>nul'
                    publishHTML(target: [
                        reportName: 'PROD Smoke - PW HTML Report',
                        reportDir: 'reports-prod/html',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                    publishHTML(target: [
                        reportName: 'PROD Smoke - Allure Report',
                        reportDir: 'reports-prod/allure',
                        reportFiles: 'index.html',
                        keepAll: true,
                        alwaysLinkToLastBuild: true
                    ])
                }
            }
        }
    }

    // ═════════════════════════════════════════════════════
    // POST — CLEANUP + EMAIL + SLACK
    // ═════════════════════════════════════════════════════
    post {
        always {
            script {
                def buildStatus = currentBuild.currentResult
                def statusEmoji = buildStatus == 'SUCCESS' ? '✅' : '❌'
                def statusColor = buildStatus == 'SUCCESS' ? 'good' : 'danger'

                // Slack Notification
                slackSend(
                    channel: env.SLACK_CHANNEL,
                    color: statusColor,
                    message: """
🎭 *Playwright CI/CD Pipeline Report* 🐳

*Overall: ${statusEmoji} ${buildStatus}*
*Mode:* `Docker Containers`
*Environment:* `${params.ENVIRONMENT}`
*Build:* #${env.BUILD_NUMBER}
*Duration:* ${currentBuild.durationString.replace(' and counting', '')}

📊 <${env.BUILD_URL}|View Reports in Jenkins>
🔍 <${env.BUILD_URL}console|View Console Logs>
                    """
                )

                // Email Notification
                emailext(
                    to: 'naveen.beniwal@antiersolutions.com',
                    subject: "🎭 CI/CD (Docker) — ${statusEmoji} ${buildStatus} — Build #${env.BUILD_NUMBER}",
                    mimeType: 'text/html',
                    body: """
                        <html>
                        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
                            <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
                                <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px;">🎭 Playwright CI/CD Dashboard 🐳</h1>
                                    <p style="margin: 8px 0 0; opacity: 0.8;">Docker Pipeline Report</p>
                                    <span style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-top: 12px; background: ${buildStatus == 'SUCCESS' ? '#28a745' : '#dc3545'}; color: white;">
                                        ${statusEmoji} ${buildStatus}
                                    </span>
                                </div>
                                <div style="padding: 24px;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr><td style="padding: 10px; color: #666;">Mode</td><td style="padding: 10px; font-weight: bold;">🐳 Docker Containers</td></tr>
                                        <tr><td style="padding: 10px; color: #666;">Environment</td><td style="padding: 10px; font-weight: bold;">${params.ENVIRONMENT}</td></tr>
                                        <tr><td style="padding: 10px; color: #666;">Build</td><td style="padding: 10px; font-weight: bold;">#${env.BUILD_NUMBER}</td></tr>
                                        <tr><td style="padding: 10px; color: #666;">Duration</td><td style="padding: 10px; font-weight: bold;">${currentBuild.durationString.replace(' and counting', '')}</td></tr>
                                    </table>
                                </div>
                                <div style="background: #f8f9fa; padding: 20px 24px; border-top: 1px solid #eee;">
                                    <h3 style="margin: 0 0 12px;">📊 Reports</h3>
                                    <a href="${env.BUILD_URL}" style="display: inline-block; padding: 10px 20px; background: #1a1a2e; color: white; text-decoration: none; border-radius: 6px; margin: 4px;">📁 Open Jenkins Build</a>
                                    <a href="${env.BUILD_URL}console" style="display: inline-block; padding: 10px 20px; background: #6c757d; color: white; text-decoration: none; border-radius: 6px; margin: 4px;">🔍 Console Logs</a>
                                </div>
                                <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
                                    Naveen Automation Labs | Playwright Framework
                                </div>
                            </div>
                        </body>
                        </html>
                    """
                )
            }

            // Cleanup Docker image after pipeline
            bat "docker rmi ${DOCKER_IMAGE} || ver>nul"
        }
        success {
            echo '═══════════════════════════════════════════'
            echo '  PIPELINE: ✅ SUCCESS (Docker)'
            echo '═══════════════════════════════════════════'
        }
        failure {
            echo '═══════════════════════════════════════════'
            echo '  PIPELINE: ❌ FAILED (Docker)'
            echo '═══════════════════════════════════════════'
        }
    }
}