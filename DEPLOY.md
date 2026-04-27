# Deployment Guide: MMU Hostel Booking System on Render

This project is configured to run on Render using a Docker container. Follow these steps to get your system live.

## Step 1: Set up a MySQL Database
Render does not offer MySQL directly. You need an external MySQL database.
- **Recommended**: [Aiven](https://aiven.io/mysql) (Free Tier available) or [Clever Cloud](https://www.clever-cloud.com/).
- Create a new MySQL service.
- Note down your **Host**, **Port** (usually 3306), **User**, **Password**, and **Database Name**.

## Step 2: Import the Database Schema
Once you have your MySQL database:
1. Connect to it using a tool like **phpMyAdmin**, **DBeaver**, or **MySQL Workbench**.
2. Open the file `new-hostel/sql/schema.sql` from this project.
3. Copy the SQL content and run it in your new database to create the tables.

## Step 3: Deploy to Render
1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will detect the `render.yaml` file and automatically configure the service.
5. You will be prompted to fill in the following environment variables:
   - `DB_HOST`: Your MySQL host.
   - `DB_USER`: Your MySQL username.
   - `DB_PASSWORD`: Your MySQL password.
   - `DB_NAME`: Your MySQL database name.
   - `MMU_SMTP_USER`: Your Gmail/SMTP email address.
   - `MMU_SMTP_PASS`: Your Gmail App Password (not your regular password).

## Step 4: Final Check
1. Once the build is complete, click the "Live" link provided by Render.
2. The site should load. Try logging in to verify the database connection.
3. Check if emails are sending (e.g., by creating a test manager or sending a support ticket).

---
**Note**: The free tier of Render "sleeps" after 15 minutes of inactivity. The first request after a long break might take 30-60 seconds to start the server.
