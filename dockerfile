# =========================
# Stage 1: Build Botpress
# (Giữ nguyên phần này)
# =========================
FROM node:12-alpine AS builder 

# Cài công cụ cần thiết 
RUN apk add --no-cache python3 make g++ bash git

WORKDIR /app
COPY . .
RUN yarn install --frozen-lockfile
RUN yarn global add gulp-cli
RUN yarn build

# =========================
# Stage 2: Runtime (production)
# =========================
FROM node:12-bullseye-slim

# 1️⃣ Tạo thư mục chạy
WORKDIR /app

# 2️⃣ Copy kết quả build từ stage 1
COPY --from=builder /app /app

# 3️⃣ Thiết lập môi trường production
ENV NODE_ENV=production

# 4️⃣ Tạo volume lưu dữ liệu bot (sẽ gắn vào ngoài host)
VOLUME ["/app/data"]

# 5️⃣ Mở cổng mặc định của Botpress
EXPOSE 3000

# 6️⃣ Lệnh chạy Botpress
CMD ["yarn", "start"]
