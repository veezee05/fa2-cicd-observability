FROM nginx:alpine

# Application
COPY index.html /usr/share/nginx/html/index.html
COPY src/ /usr/share/nginx/html/src/

# Expose nginx's stub_status on :8080/stub_status so the Prometheus
# nginx-exporter can scrape request and connection metrics.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
