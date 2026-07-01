# Copyright (C) 2026 Antitux Networks LLC <me@antitux.dev>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://gnu.org>.

FROM nginx:alpine
ARG BUILD_ENV=production
COPY index.html styles.css app.js /usr/share/nginx/html/
FROM nginx:alpine
ARG BUILD_ENV=production

COPY index.html styles.css app.js /usr/share/nginx/html/

RUN if [ "$BUILD_ENV" = "local" ]; then \
        mkdir -p /etc/nginx/ssl; \
        apk add --no-cache openssl; \
        openssl req -x509 -nodes -days 365 \
            -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/selfsigned.key \
            -out /etc/nginx/ssl/selfsigned.crt \
            -subj "/C=US/ST=State/L=City/O=Org/OU=Dev/CN=localhost"; \
    fi

COPY nginx/nginx-${BUILD_ENV}.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]