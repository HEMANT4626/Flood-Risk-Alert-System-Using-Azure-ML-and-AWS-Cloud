# Flood Risk Alert System - AWS Deployment Steps for Beginners

This project uses a hybrid setup:

- Azure handles the flood-risk prediction API.
- AWS hosts the dashboard and sends email alerts.

Use these AWS services for your module:

1. S3
2. CloudFront
3. API Gateway
4. Lambda
5. SNS
6. CloudWatch

IAM is also required automatically for permissions.

## 1. What is already ready in this project

- The dashboard frontend already calls:
  - an Azure flood-risk API
  - an AWS alert API
- The Lambda alert code is already present in `index.js/index.js`
- The frontend config is now ready for Vite environment variables in `App.js/App.js`
- A sample environment file is now present in `.env.example`

## 2. Create your AWS SNS topic

1. Sign in to AWS Console.
2. Search for `SNS`.
3. Open `Simple Notification Service`.
4. Click `Topics`.
5. Click `Create topic`.
6. Choose `Standard`.
7. Name it `FloodRiskAlerts`.
8. Click `Create topic`.
9. Copy the `Topic ARN`.

You will use this ARN in Lambda.

## 3. Create the Lambda function

1. Search for `Lambda`.
2. Click `Create function`.
3. Choose `Author from scratch`.
4. Function name: `FloodRiskAlertSender`
5. Runtime: `Node.js 22.x`
6. Architecture: `x86_64`
7. Click `Create function`.

## 4. Configure Lambda code

Your Lambda source file is:

- `index.js/index.js`

Important:

- This file uses `@aws-sdk/client-sns`
- When you deploy Lambda, include the dependency in your zip package

If you are deploying manually, your Lambda zip should contain:

- `index.js`
- `node_modules`
- `package.json` if you create one for Lambda packaging

## 5. Add Lambda environment variables

Inside the Lambda console:

1. Open `Configuration`
2. Open `Environment variables`
3. Add:

```text
SNS_TOPIC_ARN = arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:FloodRiskAlerts
AWS_REGION = us-east-1
ALLOWED_ORIGIN = https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net
```

Before CloudFront is ready, you can temporarily use:

```text
ALLOWED_ORIGIN = *
```

## 6. Attach Lambda permissions

Lambda needs permission to:

- publish alerts to SNS
- subscribe email addresses to SNS
- write logs to CloudWatch

Attach permissions that allow:

- `sns:Publish`
- `sns:Subscribe`
- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`

## 7. Test Lambda first

Before API Gateway, test Lambda directly.

Create a test event like this:

```json
{
  "httpMethod": "POST",
  "body": "{\"email\":\"your_email@example.com\",\"location\":\"Chennai\",\"risk\":\"HIGH\",\"rainfall\":90,\"waterLevel\":5,\"timestamp\":\"2026-04-15 10:00\"}"
}
```

Expected behavior:

- Lambda executes successfully
- SNS sends a confirmation email the first time
- after confirmation, alert emails can be sent

Important:

- the email owner must click the SNS confirmation link once

## 8. Create API Gateway

1. Search for `API Gateway`
2. Click `Create API`
3. Choose `REST API`
4. Name it `FloodRiskAlertAPI`
5. Create a resource called `/alert`
6. Create a `POST` method
7. Integrate it with Lambda function `FloodRiskAlertSender`
8. Enable CORS
9. Deploy API
10. Create stage `prod`

Your final alert endpoint will look like:

```text
https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/prod/alert
```

## 9. Set frontend environment values

Create a local `.env` file in the project root using `.env.example` as reference.

Example:

```text
VITE_AZURE_API_URL=https://YOUR-AZURE-APP.azurewebsites.net/api/FloodRisk
VITE_SNS_PROXY_URL=https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/prod/alert
```

## 10. Build the frontend

This project is Vite-based, so the deployment output should be the `dist` folder.

Typical build command:

```bash
npm run build
```

## 11. Create S3 bucket for the website

1. Search for `S3`
2. Click `Create bucket`
3. Give a unique name like `flood-risk-alert-system-yourname`
4. Keep a simple region like `us-east-1`
5. Create the bucket

Then:

1. Open the bucket
2. Go to `Properties`
3. Enable `Static website hosting`
4. Set:
   - `index document = index.html`
   - `error document = index.html`

## 12. Upload the frontend build

Upload all files inside the built `dist` folder to S3.

Do not upload the folder itself as one nested folder.

Upload the contents inside `dist`.

## 13. Add bucket policy for public website access

In the bucket `Permissions` tab, add a bucket policy like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

Replace `YOUR_BUCKET_NAME` with your real bucket name.

## 14. Create CloudFront distribution

1. Search for `CloudFront`
2. Click `Create distribution`
3. For origin, use the S3 static website endpoint
4. Set viewer protocol policy to `Redirect HTTP to HTTPS`
5. Set default root object to `index.html`
6. Add custom error responses:
   - `403 -> /index.html -> 200`
   - `404 -> /index.html -> 200`
7. Create distribution

Wait for deployment to finish.

Then copy the CloudFront domain:

```text
https://YOUR_DISTRIBUTION.cloudfront.net
```

## 15. Update Azure CORS

Your Azure API must allow requests from:

- `http://127.0.0.1:8000` for local development
- your CloudFront URL for deployed production use

Without this, the website may open but API calls will fail.

## 16. Update Lambda CORS for production

After CloudFront is working, go back to Lambda environment variables and change:

```text
ALLOWED_ORIGIN = https://YOUR_DISTRIBUTION.cloudfront.net
```

This is safer than keeping `*`.

## 17. Test the complete system

Test in this order:

1. Open the CloudFront URL
2. Enter location, rainfall, and water level
3. Submit the form
4. Confirm the Azure API returns a risk
5. Enter an email address
6. Confirm API Gateway is called
7. Confirm Lambda runs
8. Confirm SNS email is received

## 18. Use CloudWatch if something fails

1. Open `CloudWatch`
2. Open `Log groups`
3. Open the Lambda log group
4. Read the latest log stream

Check for:

- missing permissions
- wrong topic ARN
- CORS issues
- email not confirmed in SNS
- invalid JSON body

## 19. Suggested viva or report explanation

You can explain the module like this:

`The frontend dashboard is hosted on Amazon S3 and delivered securely through Amazon CloudFront. User alert requests are sent through Amazon API Gateway to an AWS Lambda function. The Lambda function publishes notification messages to Amazon SNS, which sends alert emails to subscribed users. Amazon CloudWatch is used to monitor logs and diagnose errors. The flood-risk prediction API remains deployed on Azure, making the overall solution a hybrid multi-cloud architecture.`
