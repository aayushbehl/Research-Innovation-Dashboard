const https = require('https');

const postRequest = (url) => new Promise((resolve, reject) => {
    const splitUrl = url.split('/');
    const options = {
        host: splitUrl[2], // e.g. webhooks.amplify.ca-central-1.amazonaws.com
        path: `/${splitUrl[3]}/${splitUrl[4]}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
    };
    
    //create the request object with the callback with the result
    const req = https.request(options, (res) => {
        resolve(JSON.stringify(res.statusCode));
    });
  
    // handle the possible errors
    req.on('error', (e) => {
        reject(e.message);
    });
      
    //do the request
    req.write(JSON.stringify({}));
  
    //finish the request
    req.end();  
});

exports.handler = async (event) => {
    const webhookUrl = event['Webhook']['WebhookUrl'];
    const webhookId = event['Webhook']['WebhookId'];
    const result = await postRequest(webhookUrl);
    return {
        id: webhookId,
        statusCode: result
    }
};