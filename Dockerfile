# Base image
FROM node:18

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

