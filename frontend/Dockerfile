
# frontend/Dockerfile
# Build stage: compile the React/Vite app
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
# Use npm ci if you have a lockfile; falls back to npm install otherwise
RUN if [ -f package-lock.json ]; then npm ci --no-fund --no-audit; else npm install --no-fund --no-audit; fi

# Copy source and build
COPY . .
# If you use VITE_API_BASE_URL via .env, it will be read at build time
RUN npm run build

# Runtime stage: serve static files with Nginx
FROM nginx:1.25-alpine
# Remove default config and add our minimal config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
