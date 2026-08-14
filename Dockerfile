FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
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
