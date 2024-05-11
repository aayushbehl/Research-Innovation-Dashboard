import * as cdk from "aws-cdk-lib";
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { VpcStack } from "./vpc-stack";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import * as glue from "aws-cdk-lib/aws-glue";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Effect } from "aws-cdk-lib/aws-iam";
import { GrantDataStack } from "./grantdata-stack";
import { aws_stepfunctions_tasks as tasks} from 'aws-cdk-lib';
import { AppsyncStack } from "./appsync-stack";
import { CloudfrontAuthStack } from '../lib/cloudfrontauth-stack';
import { DefinitionBody, IntegrationPattern, JsonPath, StateMachine, TaskInput } from "aws-cdk-lib/aws-stepfunctions";
import { AllowedMethods, CacheHeaderBehavior, CachePolicy, Distribution, OriginRequestPolicy, ResponseHeadersPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";


export class GraphDataStack extends Stack {
    constructor(
    scope: Construct,
    id: string,
    grantDataStack: GrantDataStack,
    vpcStack: VpcStack,
    dataFetchRole: iam.Role,
    appSyncStack: AppsyncStack,
    cloudfrontAuthStack: CloudfrontAuthStack,
    props?: StackProps
  ) {
    super(scope, id, props);

    // S3 Bucket to store the graph
    // DO NOT CHANGE BUCKET NAME
    const graphBucket = new s3.Bucket(this, 'GraphBucket', {
      bucketName: 'expertise-dashboard-graph-bucket',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    // Create new Glue Role. DO NOT RENAME THE ROLE!!!
    const roleName = "AWSGlueServiceRole-GraphData";
    const glueRole = new iam.Role(this, roleName, {
      assumedBy: new iam.ServicePrincipal("glue.amazonaws.com"),
      description: "Glue Service Role for Graph ETL",
      roleName: roleName,
    });

    // Add different policies to glue-service-role
    const glueServiceRolePolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSGlueServiceRole"
    );
    const glueConsoleFullAccessPolicy =
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSGlueConsoleFullAccess");
    const glueSecretManagerPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(
      "SecretsManagerReadWrite"
    );
    const glueAmazonS3FullAccessPolicy =
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess");

    glueRole.addManagedPolicy(glueServiceRolePolicy);
    glueRole.addManagedPolicy(glueConsoleFullAccessPolicy);
    glueRole.addManagedPolicy(glueSecretManagerPolicy);
    glueRole.addManagedPolicy(glueAmazonS3FullAccessPolicy);
    //Create a policy to start DMS task
    glueRole.addToPolicy(new iam.PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "dms:StartReplicationTask",
        "dms:DescribeReplicationTasks"
      ],
      resources: ["*"] // DO NOT CHANGE
    }));

    // reuse Glue bucket from grant to store glue Script
    const glueS3Bucket = grantDataStack.glueS3Bucket;
    // reuse Glue DMS Connection's name
    const glueDmsConnectionName = grantDataStack.glueDmsConnectionName;

    // define a Glue Python Shell Job
    const PYTHON_VER = "3.9";
    const GLUE_VER = "3.0";
    const MAX_RETRIES = 0; // no retries, only execute once
    const MAX_CAPACITY = 1; // 1/16 of a DPU, lowest setting
    const MAX_CONCURRENT_RUNS = 7; // 7 concurrent runs of the same job simultaneously
    const TIMEOUT = 2880; // 2880 min timeout duration
    const defaultArguments = {
      "--extra-py-files": `s3://${glueS3Bucket.bucketName}/extra-python-libs/pyjarowinkler-1.8-py2.py3-none-any.whl,s3://${glueS3Bucket.bucketName}/extra-python-libs/custom_utils-0.1-py3-none-any.whl`,
      "library-set": "analytics",
      "--DB_SECRET_NAME": grantDataStack.secretPath,
      "--FILE_PATH": "",
      "--EQUIVALENT": "false",
      "--DMS_TASK_ARN": grantDataStack.dmsTaskArn,
      "--additional-python-modules": "psycopg2-binary"

    };

    // Glue Job: Create edges/connections for graph
    const createEdgesJobName = "expertiseDashboard-createEdges";
    const createEdgesJob = new glue.CfnJob(this, createEdgesJobName, {
      name: createEdgesJobName,
      role: glueRole.roleArn,
      command: {
        name: "pythonshell",
        pythonVersion: PYTHON_VER,
        scriptLocation:
          "s3://" +
          glueS3Bucket.bucketName +
          "/scripts/graph-etl/" +
          "createEdges" +
          ".py",
      },
      executionProperty: {
        maxConcurrentRuns: MAX_CONCURRENT_RUNS,
      },
      connections: {
        connections: [glueDmsConnectionName]
      },
      maxRetries: MAX_RETRIES,
      maxCapacity: MAX_CAPACITY,
      timeout: TIMEOUT, // 120 min timeout duration
      glueVersion: GLUE_VER,
      defaultArguments: defaultArguments,
    });

    // Glue Job: Create similar researchers for graph
    const createSimilarResearchersJobName = "expertiseDashboard-CreateSimilarResearchers";
    const createSimilarResearchersJob = new glue.CfnJob(this, createSimilarResearchersJobName, {
      name: createSimilarResearchersJobName,
      role: glueRole.roleArn,
      command: {
        name: "pythonshell",
        pythonVersion: PYTHON_VER,
        scriptLocation:
          "s3://" +
          glueS3Bucket.bucketName +
          "/scripts/graph-etl/" +
          "CreateSimilarResearchers" +
          ".py",
      },
      executionProperty: {
        maxConcurrentRuns: MAX_CONCURRENT_RUNS,
      },
      connections: {
        connections: [glueDmsConnectionName]
      },
      maxRetries: MAX_RETRIES,
      maxCapacity: MAX_CAPACITY,
      timeout: TIMEOUT, // 120 min timeout duration
      glueVersion: GLUE_VER,
      defaultArguments: defaultArguments,
    });

    // Deploy glue job to glue S3 bucket
    new s3deploy.BucketDeployment(this, "DeployGlueJobFiles", {
      sources: [s3deploy.Source.asset("./glue/scripts/graph-etl")],
      destinationBucket: glueS3Bucket,
      destinationKeyPrefix: "scripts/graph-etl",
    });

    // Grant S3 read/write role to Glue
    glueS3Bucket.grantReadWrite(glueRole);

    // Destroy Glue related resources when GraphDataStack is deleted
    createEdgesJob.applyRemovalPolicy(RemovalPolicy.DESTROY);
    createSimilarResearchersJob.applyRemovalPolicy(RemovalPolicy.DESTROY);
    glueRole.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const createXY = new NodejsFunction(this, 'expertiseDashboard-createXYForGraph', {
      bundling: {
          nodeModules: [
            'graphology',
            'graphology-layout',
            'graphology-layout-forceatlas2'
          ],
          externalModules: [
          '@aws-sdk/*'
          ]
      },
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'expertiseDashboard-createXYForGraph',
      entry: 'lambda/createXYForGraph/createXYForGraph.js',
      handler: 'index.handler',
      depsLockFilePath: 'lambda/createXYForGraph/package-lock.json',
      role: dataFetchRole,
      environment: {
        'GRAPH_BUCKET': graphBucket.bucketName
      },
      timeout: cdk.Duration.minutes(15),
      memorySize: 512
    });

    const redeployAmplify = new lambda.Function(this, 'expertiseDashboard-redeployAmplify', {
      runtime: lambda.Runtime.PYTHON_3_10,
      functionName: 'expertiseDashboard-redeployAmplify',
      handler: 'redeployAmplify.lambda_handler',
      code: lambda.Code.fromAsset('lambda/redeployAmplify'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(300),
      role: dataFetchRole
    });

    // Step function workflow for knowledge graph

    const fetchNodesStep = new tasks.LambdaInvoke(this, 'fetchNodesStep', {
      lambdaFunction: appSyncStack.fetchResearcherNodes,
      payload: TaskInput.fromObject({
        facultiesToFilterOn: [],
        keyword: '',
        stepFunctionCall: true
      })
    });

    const createXYStep = new tasks.LambdaInvoke(this, 'createXYStep', {
      lambdaFunction: createXY
    });

    const createEdgesStep = new tasks.GlueStartJobRun(this, 'createEdgesStep', {
      glueJobName: createEdgesJobName,
      integrationPattern: IntegrationPattern.RUN_JOB
    });

    const createSimilarResearchersStep = new tasks.GlueStartJobRun(this, 'createSimilarResearchersStep', {
      glueJobName: createSimilarResearchersJobName,
      integrationPattern: IntegrationPattern.RUN_JOB
    });

    const getParametersStep = new tasks.CallAwsService(this, 'getParametersStep', {
      service: 'ssm',
      action: 'getParameters',
      iamResources: ['*'],
      iamAction: 'ssm:*',
      parameters: {
        "Names": [
          '/amplify/branchName',
          '/amplify/appId'
        ]
      }
    });

    const createWebhookStep = new tasks.CallAwsService(this, 'createWebhookStep', {
      service: 'amplify',
      action: 'createWebhook',
      iamResources: ['*'],
      iamAction: 'amplify:*',
      parameters: {
        "AppId": JsonPath.stringAt('$.Parameters[0].Value'),
        "BranchName": JsonPath.stringAt('$.Parameters[1].Value') 
      }
    });

    const redeployAmplifyStep = new tasks.LambdaInvoke(this, 'redeployAmplifyStep', {
      lambdaFunction: redeployAmplify
    });

    const deleteWebhookStep = new tasks.CallAwsService(this, 'deleteWebhookStep', {
      service: 'amplify',
      action: 'deleteWebhook',
      iamResources: ['*'],
      iamAction: 'amplify:*',
      parameters: {
        "WebhookId": JsonPath.stringAt('$.id') 
      }
    })

    // Cloudfront
    const cloudFrontDistribution = new Distribution(this, 'cloudfrontGraph', {
      defaultBehavior: {
        origin: new S3Origin(graphBucket),
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
        cachePolicy: new CachePolicy(this, 'customCachePolicy', {
          cachePolicyName: 'CustomCachePolicy',
          headerBehavior: CacheHeaderBehavior.allowList('Authorization', 'clientId', 'region'),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
          minTtl: cdk.Duration.seconds(1),
          maxTtl: cdk.Duration.seconds(31536000),
          defaultTtl: cdk.Duration.seconds(86400)
        }),
        responseHeadersPolicy: new ResponseHeadersPolicy(this, 'customCORS', {
          responseHeadersPolicyName: 'CustomCORSPolicy',
          corsBehavior: {
            accessControlAllowCredentials: false,
            accessControlAllowHeaders: ['Content-Type', 'authorization', 'clientid', 'region'],
            accessControlAllowMethods: ['GET', 'POST', 'OPTIONS'],
            accessControlAllowOrigins: ['*'],
            originOverride: true
          }
        }),
        edgeLambdas: [{
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: cloudfrontAuthStack.cloudfrontAuth.currentVersion,
        }]
      }
    });

    const invalidationStep = new tasks.CallAwsService(this, 'invalidateCloudfront', {
      service: 'cloudfront',
      action: 'createInvalidation',
      iamResources: ['*'],
      iamAction: 'cloudfront:*',
      parameters: {
        'DistributionId': cloudFrontDistribution.distributionId,
        'InvalidationBatch': {
          'CallerReference': JsonPath.stringAt("$$.Execution.Id"),
          'Paths': {
            'Items': ['/*'],
            'Quantity': 1
          }
        }
      }
    });

    const graphStateMachineDefinition = createEdgesStep
            .next(createSimilarResearchersStep)
            .next(fetchNodesStep)
            .next(createXYStep)
            .next(invalidationStep)
            .next(getParametersStep)
            .next(createWebhookStep)
            .next(redeployAmplifyStep)
            .next(deleteWebhookStep);

    const graphStateMachine = new StateMachine(this, 'graphStateMachine', {
      definitionBody: DefinitionBody.fromChainable(graphStateMachineDefinition),
      stateMachineName: 'expertiseDashboard-graphStepFunction'
    });

    const cloudfrontUrlParam = new ssm.StringParameter(this, 'cloudfrontUrlParam', {
      parameterName: '/amplify/cloudfront',
      stringValue: `https://${cloudFrontDistribution.distributionDomainName}/`
    });

  }
}
