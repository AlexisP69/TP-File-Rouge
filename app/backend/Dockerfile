FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./ 2>/dev/null || true
RUN npm install --production || npm install --only=prod

COPY index.js ./ 

EXPOSE 3000

CMD ["npm", "start"]
