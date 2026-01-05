
# Dockerfile
# Multi-stage build for the DriverSafetyBonus API

# --- Build stage ---
FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app

# Cache deps
COPY go.mod ./
RUN go mod download

# Copy source
COPY . .

# Build static binary for linux
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./main.go

# --- Runtime stage ---
FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata \
    && ln -s /usr/share/zoneinfo/America/Winnipeg /etc/localtime \
    && echo "America/Winnipeg" > /etc/timezone
WORKDIR /root
COPY --from=builder /app/server .
EXPOSE 8080

ENV API_PORT=8080
ENV TZ=America/Winnipeg
# Example: safety_user:safety_password@tcp(db:3306)/driver_safety?parseTime=true
ENV DB_DSN="root:password@tcp(localhost:3306)/driver_safety?parseTime=true"

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${API_PORT}/api/healthz || exit 1

CMD ["./server"]
