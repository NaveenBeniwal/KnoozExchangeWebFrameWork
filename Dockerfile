# Base image ships Node.js + all Playwright browser binaries and OS deps
# preinstalled — version pinned to match the exact @playwright/test version
# resolved in package-lock.json, so the bundled browsers match what the
# project's own tests were written/run against.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# bzip2 isn't in this base image, but the phantomjs-prebuilt postinstall script
# (pulled in transitively, likely via markdown-pdf) needs it to extract its
# .tar.bz2 download — confirmed live: npm ci failed with "tar (child): bzip2:
# Cannot exec: No such file or directory" without this.
RUN apt-get update && apt-get install -y bzip2 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npx", "playwright", "test"]
