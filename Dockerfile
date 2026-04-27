# Use PHP 8.2 with Apache
FROM php:8.2-apache

# Install mysqli extension
RUN docker-php-ext-install mysqli && docker-php-ext-enable mysqli

# Enable Apache mod_rewrite for SPA routing (.htaccess)
RUN a2enmod rewrite

# Set the working directory to Apache's default web root
WORKDIR /var/www/html

# Copy all files from the current directory to the container
# .dockerignore will handle excluding unnecessary files
COPY . .

# Set permissions for Apache
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# The default port for Apache is 80, Render will handle the mapping.
EXPOSE 80

# Start Apache in the foreground
CMD ["apache2-foreground"]
