FROM node:18-bookworm

RUN apt-get update && apt-get install -y \
    python3 build-essential fontconfig fonts-liberation \
    libfontconfig1 libpango-1.0-0 libcairo2-dev \
    libpixman-1-dev libpangocairo-1.0-0 libharfbuzz0b \
    libfreetype6-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# هذا السطر مهم جداً لجعل النظام يتعرف على ملف font.ttf المنسوخ
RUN fc-cache -f -v

CMD ["node", "index.js"]
