FROM node:lts

# Kufunga vifaa vya msingi vya sauti, picha na sticker
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg imagemagick webp && apt-get clean

WORKDIR /app

COPY package*.json ./

RUN npm install && npm cache clean --force

COPY . .

EXPOSE 3000

ENV NODE_ENV production

CMD ["npm", "start"]
