FROM node:16.15.1-buster-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# For production use
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8080

ENTRYPOINT ["npm", "start"]
