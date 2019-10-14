FROM node:10

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --prod

COPY . .

CMD [ "yarn", "start" ]