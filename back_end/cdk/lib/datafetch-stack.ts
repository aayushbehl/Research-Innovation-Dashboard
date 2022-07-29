import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_rds as rds } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_iam as iam} from 'aws-cdk-lib';
import  { aws_s3 as s3 } from 'aws-cdk-lib'
import { aws_s3_deployment as deployment } from 'aws-cdk-lib';
import { aws_stepfunctions as sfn} from 'aws-cdk-lib';
import { aws_stepfunctions_tasks as tasks} from 'aws-cdk-lib';

export class DataFetchStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /*
      Define Lambda Layers
    */
    // The layer containing the requests library
    const requests = new lambda.LayerVersion(this, 'requests', {
      code: lambda.Code.fromAsset('layers/requests.zip'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_6],
      description: 'Contains the requests library',
    });

    // The layer containing the psycopg2 library
    const psycopg2 = new lambda.LayerVersion(this, 'psycopg2', {
      code: lambda.Code.fromAsset('layers/psycopg2.zip'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_6],
      description: 'Contains the psycopg2 library',
    });

    // The layer containing the postgres library
    // I defined this in one of my stacks do we want to have a layers stack?? -Matt
    const postgres = new lambda.LayerVersion(this, 'postgres', {
      code: lambda.Code.fromAsset('layers/postgres.zip'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      description: 'Contains the postgres library',
    });

    /*
      Define Lambdas and add correct permissions
    */
    const researcherFetch = new lambda.Function(this, 'researcherFetch', {
      runtime: lambda.Runtime.PYTHON_3_6,
      handler: 'researcherFetch.lambda_handler',
      layers: [psycopg2],
      code: lambda.Code.fromAsset('lambdas/researcherFetch'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    });
    researcherFetch.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonS3FullAccess',
      ),
    );
    researcherFetch.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMReadOnlyAccess',
      ),
    );

    const elsevierFetch = new lambda.Function(this, 'elsevierFetch', {
      runtime: lambda.Runtime.PYTHON_3_6,
      handler: 'elsevierFetch.lambda_handler',
      layers: [requests, psycopg2],
      code: lambda.Code.fromAsset('lambdas/'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    });
    elsevierFetch.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMReadOnlyAccess',
      ),
    );

    const orcidFetch = new lambda.Function(this, 'orcidFetch', {
      runtime: lambda.Runtime.PYTHON_3_6,
      handler: 'orcidFetch.lambda_handler',
      layers: [requests, psycopg2],
      code: lambda.Code.fromAsset('lambdas/'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    });
    orcidFetch.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMReadOnlyAccess',
      ),
    );

    const publicationFetch = new lambda.Function(this, 'publicationFetch', {
      runtime: lambda.Runtime.PYTHON_3_6,
      handler: 'publicationFetch.lambda_handler',
      layers: [requests, psycopg2],
      code: lambda.Code.fromAsset('lambdas/'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    });
    publicationFetch.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMReadOnlyAccess',
      ),
    );

    /*
        Set up step function
    */
    const researcherFetchInvoke = new tasks.LambdaInvoke(this, 'Fetch Researchers', {
      lambdaFunction: researcherFetch,
      outputPath: '$.Payload',
    });
    const researcherMap = new sfn.Map(this, 'Researcher Map', {
      maxConcurrency: 40,
      itemsPath: '$.indices'
    });
    researcherMap.iterator(researcherFetchInvoke);

    const elsevierFetchInvoke = new tasks.LambdaInvoke(this, 'Fetch Elsevier Data', {
      lambdaFunction: elsevierFetch,
      outputPath: '$.Payload',
    });

    const orcidFetchInvoke = new tasks.LambdaInvoke(this, 'Fetch Elsevier Data', {
      lambdaFunction: orcidFetch,
      outputPath: '$.Payload',
    });

    const publicationFetchInvoke = new tasks.LambdaInvoke(this, 'Fetch Publications', {
      lambdaFunction: publicationFetch,
      outputPath: '$.Payload',
    });
    const publicationMap = new sfn.Map(this, 'Publication Map', {
      maxConcurrency: 5,
      itemsPath: '$'
    })
    publicationMap.iterator(publicationFetchInvoke);

    const definition = researcherMap
      .next(elsevierFetchInvoke)
      .next(orcidFetchInvoke)
      .next(publicationMap);
    
    const dataFetch = new sfn.StateMachine(this, 'StateMachine', {
      definition,
    });


  }
}