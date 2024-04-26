const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");


// Use this request to answer to the OPTIONS preflight call
const preflightCall = {
        status: "204",
        headers: {
                'access-control-allow-origin': [{
                    key: 'Access-Control-Allow-Origin',
                    value: "*",
                }],
                 'access-control-request-method': [{
                    key: 'Access-Control-Request-Method',
                    value: "PUT, GET, OPTIONS, DELETE",
                }],
                 'access-control-allow-headers': [{
                    key: 'Access-Control-Allow-Headers',
                    value: "*",
                }]
        },
    };


exports.handler = async (event, context, callback) => {
     const request = event.Records[0].cf.request;
     const headers = request.headers;
     console.log(headers)
     if(request.method === 'OPTIONS') {
          console.log('preflight call');
          callback(null, preflightCall);
          return;
     }

     if (headers.authorization == null || headers.clientid == null || headers.region == null) {
        request.uri = '/'
        callback(null, request)
     }

     const client = new SSMClient({region: headers.region[0].value});
     const input = { // GetParameterRequest
          Name: "/amplify/userPool",
          WithDecryption: true
     };

     const command = new GetParameterCommand(input)
     const userPool = await client.send(command)
          
     const verifier = CognitoJwtVerifier.create({
          userPoolId: userPool.Parameter.Value,
          tokenUse: "access",
          clientId: headers.clientid[0].value
     });
     
     try {
          const payload = await verifier.verify(headers.authorization[0].value)
          console.log('Token valid!')
     } catch (error) {
          console.log("Token not valid!");
          console.log(error);
          request.uri = '/'
     }
     
     
     callback(null, request);
};