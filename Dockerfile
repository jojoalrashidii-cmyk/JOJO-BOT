# استخدام نسخة Node.js الرسمية
FROM node:18-bookworm

# تثبيت الحزم الأساسية لنظام Linux التي يحتاجها Canvas للرسم والتعامل مع الخطوط
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    fontconfig \
    fonts-liberation \
    libfontconfig1 \
    libpango-1.0-0 \
    libcairo2-dev \
    libpixman-1-dev \
    libpangocairo-1.0-0 \
    libharfbuzz0b \
    libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات تعريف الحزم وتثبيتها
COPY package*.json ./
RUN npm install

# نسخ باقي ملفات البوت
COPY . .

# تشغيل البوت
CMD ["node", "index.js"]
