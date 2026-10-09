FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json start.mjs server.mjs service.mjs analyze.mjs courses.mjs ./
COPY --chown=node:node dist/index.html dist/app.js dist/style.css dist/manual.html dist/manual.css ./dist/
USER node
ENV HOST=0.0.0.0 PORT=4317
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4317/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "start.mjs"]
