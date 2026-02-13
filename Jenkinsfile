pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'jyok1m/ipseis-backend'
        DOCKER_TAG = "${env.BRANCH_NAME == 'main' ? 'latest' : env.BRANCH_NAME == 'stg' ? 'staging' : 'dev'}"
    }

    stages {
        stage('Build') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'stg'
                    branch 'main'
                }
            }
            steps {
                sh '''
                    docker build -t $DOCKER_IMAGE:$DOCKER_TAG .
                '''
            }
        }

        stage('Publish') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'stg'
                    branch 'main'
                }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push $DOCKER_IMAGE:$DOCKER_TAG
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy dev') {
            when {
                anyOf {
                    branch 'dev'
                }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'host-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
                    string(credentialsId: 'host-gateway-ip', variable: 'HOST_IP'),
                    string(credentialsId: 'host-ssh-port', variable: 'HOST_PORT'),
                    usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')
                ]) {
                    sh '''
                        ssh -i "$SSH_KEY" -p "$HOST_PORT" -o StrictHostKeyChecking=no "$SSH_USER@$HOST_IP" \
                            "echo '$DOCKER_PASS' | docker login -u '$DOCKER_USER' --password-stdin && \
                             docker compose -f /opt/ipseis/docker-compose.yml --profile dev pull && \
                             docker compose -f /opt/ipseis/docker-compose.yml --profile dev up -d && \
                             docker logout"
                    '''
                }
            }
        }

        stage('Deploy prod') {
            when {
                anyOf {
                    branch 'main'
                }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'host-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
                    string(credentialsId: 'host-gateway-ip', variable: 'HOST_IP'),
                    string(credentialsId: 'host-ssh-port', variable: 'HOST_PORT'),
                    usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')
                ]) {
                    sh '''
                        ssh -i "$SSH_KEY" -p "$HOST_PORT" -o StrictHostKeyChecking=no "$SSH_USER@$HOST_IP" \
                            "echo '$DOCKER_PASS' | docker login -u '$DOCKER_USER' --password-stdin && \
                             docker compose -f /opt/ipseis/docker-compose.yml --profile prod pull && \
                             docker compose -f /opt/ipseis/docker-compose.yml --profile prod up -d && \
                             docker logout"
                    '''
                }
            }
        }
    }

    post {
        always {
            sh "docker rmi $DOCKER_IMAGE:$DOCKER_TAG || true"
        }
    }
}
