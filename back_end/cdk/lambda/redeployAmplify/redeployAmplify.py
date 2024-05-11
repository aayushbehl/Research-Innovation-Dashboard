import botocore.vendored.requests as requests

def lambda_handler(event, context):
    webhook_url = event.Webhook.WebhookUrl
    webhook_id = event.Webhook.WebhookId

    response = requests.post(webhook_url)

    return {
        'id': webhook_id,
        'response': response
    }