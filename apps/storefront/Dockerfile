# syntax=docker/dockerfile:1
FROM node:20-bullseye-slim AS base
WORKDIR /app

FROM base AS builder
COPY package.json yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY turbo.json ./
COPY apps apps

FROM base AS installer
COPY --from=builder /app /app
RUN corepack enable && corepack prepare yarn@4.0.0 --activate
RUN yarn install
RUN yarn workspace storefront build

FROM base AS runner
COPY --from=installer /app /app
WORKDIR /app/apps/storefront
RUN corepack enable && corepack prepare yarn@4.0.0 --activate
CMD ["yarn", "start:prod"]