FROM node:25.6-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY . .

EXPOSE 3000

CMD ["node", "./bin/www"]
