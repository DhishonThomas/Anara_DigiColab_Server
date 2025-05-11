FROM node:18-slim
# Install Puppeteer Chromium dependencies
RUN apt-get update && apt-get install -y \
wget \
ca-certificates \
fonts-liberation \
libappindicator3-1 \
libasound2 \
libatk-bridge2.0-0 \
libatk1.0-0 \
libcups2 \
libdbus-1-3 \
libgdk-pixbuf2.0-0 \
libnspr4 \
libnss3 \
libx11-xcb1 \
libxcomposite1 \
libxdamage1 \
libxrandr2 \
libgbm1 \
xdg-utils \
--no-install-recommends && \
apt-get clean && \
rm -rf /var/lib/apt/lists/*


# Set working dir
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose app port
EXPOSE 4000

# Start the app
CMD ["npm", "start"]

