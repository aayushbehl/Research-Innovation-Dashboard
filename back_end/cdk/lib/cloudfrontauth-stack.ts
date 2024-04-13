import * as cdk from 'aws-cdk-lib';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as lambda from "aws-cdk-lib/aws-lambda";
export class CloudfrontAuthStack extends cdk.Stack {
    public readonly cloudfrontAuth: lambda.Function;
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const cognitoRole = new Role(this, 'cognitoRole', {
            roleName: 'CognitoRole',
            assumedBy: new ServicePrincipal('lambda.amazonaws.com')
        });

        cognitoRole.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "cognito-identity:*",
            ],
            resources: ['*']
          }));

        cognitoRole.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                // CloudWatch Logs
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            resources: ["arn:aws:logs:*:*:*"]
        }))
        
        // Lambda@Edge Authorization Function
        this.cloudfrontAuth = new lambda.Function(this, 'expertiseDashboard-cloudfrontAuth', {
            handler: 'cloudfrontAuth.handler',
            runtime: lambda.Runtime.NODEJS_18_X,
            functionName: 'expertiseDashboard-cloudfrontAuth',
            code: new lambda.AssetCode('lambda/cloudfrontAuth'),
            role: cognitoRole,
            timeout: cdk.Duration.seconds(5),
            memorySize: 128
        });
    }
}