FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev && rm -rf /usr/local/lib/node_modules/npm && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
