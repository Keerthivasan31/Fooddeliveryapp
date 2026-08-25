# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_AUTH_API_URL=http://localhost:4003
ARG VITE_ORDER_SERVICE_URL=http://localhost:4000
ARG VITE_PAYMENT_SERVICE_URL=http://localhost:4001
ARG VITE_TRACKING_SERVICE_URL=http://localhost:4002
ARG VITE_AUTH_APP_URL=http://localhost:9000
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL
ENV VITE_ORDER_SERVICE_URL=$VITE_ORDER_SERVICE_URL
ENV VITE_PAYMENT_SERVICE_URL=$VITE_PAYMENT_SERVICE_URL
ENV VITE_TRACKING_SERVICE_URL=$VITE_TRACKING_SERVICE_URL
ENV VITE_AUTH_APP_URL=$VITE_AUTH_APP_URL
RUN npm run build

# Serve stage - static assets served by nginx, fronted by ALB / ECS
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
