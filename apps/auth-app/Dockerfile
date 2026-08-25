FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_AUTH_API_URL=http://localhost:4003
ARG VITE_CUSTOMER_APP_URL=http://localhost:9001
ARG VITE_RESTAURANT_APP_URL=http://localhost:9002
ARG VITE_DELIVERY_APP_URL=http://localhost:9003
ARG VITE_ADMIN_APP_URL=http://localhost:9004
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL
ENV VITE_CUSTOMER_APP_URL=$VITE_CUSTOMER_APP_URL
ENV VITE_RESTAURANT_APP_URL=$VITE_RESTAURANT_APP_URL
ENV VITE_DELIVERY_APP_URL=$VITE_DELIVERY_APP_URL
ENV VITE_ADMIN_APP_URL=$VITE_ADMIN_APP_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx","-g","daemon off;"]
