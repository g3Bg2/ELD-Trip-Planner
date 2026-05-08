# syntax=docker/dockerfile:1.6

# ─────────── Build stage ───────────
FROM node:22-alpine AS build

WORKDIR /app

# The Vite API base URL is baked in at build time. Override with a build-arg.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────── Runtime stage ───────────
FROM nginx:1.27-alpine AS runtime

# Strip default nginx site
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
