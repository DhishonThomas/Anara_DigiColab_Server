# Base image
FROM node:18

# Install necessary dependencies for Chrome/Chromium
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxshm1 \
    libasound2 \
    libdbus-glib-1-2 \
    libxtst6 \
    xauth \
    xvfb \
    --no-install-recommends

# Set up xvfb (Virtual X Framebuffer)
RUN Xvfb :99 -screen 0 1280x1024x24 &

ENV DISPLAY=:99

# Set working directory in the container
WORKDIR /usr/src/app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Expose the port your app listens on (adjust if different)
EXPOSE 4000

# Run the application
CMD ["npm", "start"]