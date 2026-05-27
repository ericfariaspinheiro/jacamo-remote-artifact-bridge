# Protocolo — Remote Artifact Bridge

Este documento descreve o protocolo de comunicação usado pelo projeto Remote Artifact Bridge.

O protocolo define como o artefato-proxy em Java/CArtAgO se comunica com o runtime externo de artefatos, inicialmente implementado em TypeScript.

A comunicação atual é feita por meio de mensagens JSON enviadas por WebSocket.

## Objetivo do protocolo

O objetivo do protocolo é permitir que JaCaMo execute operações em artefatos externos sem conhecer a linguagem em que esses artefatos foram implementados.

Em vez de o agente Jason chamar diretamente uma função TypeScript, Python ou de outra linguagem, ele chama uma operação CArtAgO. O artefato-proxy transforma essa chamada em uma mensagem JSON e a envia ao runtime externo.

O runtime externo executa a lógica real do artefato e devolve mensagens que são convertidas pelo proxy em sinais ou propriedades observáveis para o agente Jason.

## Visão geral do fluxo

O fluxo geral é:

```text
1. O agente Jason chama uma operação CArtAgO.
2. O EchoProxyArtifact recebe essa chamada.
3. O RemoteArtifact cria uma mensagem operation_request.
4. A mensagem é enviada ao runtime TypeScript via WebSocket.
5. O runtime TypeScript executa a operação solicitada.
6. O runtime devolve uma ou mais mensagens de resposta.
7. O RemoteArtifact interpreta as mensagens recebidas.
8. O CArtAgO emite signals perceptíveis pelo agente Jason.
```

## Tipos de mensagem

O MVP atual suporta quatro tipos principais de mensagem:

```text
operation_request
signal
done
error
```

Esses tipos foram escolhidos para representar o ciclo mínimo de uma operação remota:

```text
início da operação;
emissão de resultado;
conclusão;
falha.
```

## operation_request

A mensagem `operation_request` é enviada pelo proxy Java para o runtime externo.

Ela representa uma solicitação para executar uma operação em um artefato remoto.

Exemplo:

```json
{
  "type": "operation_request",
  "callId": "1",
  "artifact": "EchoArtifact",
  "operation": "echo",
  "args": {
    "message": "hello from Jason"
  }
}
```

### Campos

```text
type
Valor fixo: operation_request.

callId
Identificador único da chamada.
Permite correlacionar as respostas recebidas com a operação solicitada.

artifact
Nome do artefato remoto que deve executar a operação.

operation
Nome da operação que deve ser executada.

args
Objeto contendo os argumentos da operação.
```

### Função no MVP

No MVP atual, o agente Jason chama:

```asl
echo("hello from Jason").
```

O proxy Java transforma essa chamada em:

```json
{
  "type": "operation_request",
  "callId": "1",
  "artifact": "EchoArtifact",
  "operation": "echo",
  "args": {
    "message": "hello from Jason"
  }
}
```

## signal

A mensagem `signal` é enviada pelo runtime externo para o proxy Java.

Ela indica que o runtime deseja emitir um sinal para o agente Jason.

Exemplo:

```json
{
  "type": "signal",
  "callId": "1",
  "name": "echo_result",
  "args": ["hello from Jason"]
}
```

### Campos

```text
type
Valor fixo: signal.

callId
Identificador da chamada relacionada.

name
Nome do sinal que deve ser emitido no CArtAgO.

args
Lista de argumentos do sinal.
```

### Conversão para CArtAgO

O proxy Java converte essa mensagem em uma chamada CArtAgO equivalente a:

```java
signal("echo_result", "hello from Jason");
```

O agente Jason pode reagir a esse sinal com um plano como:

```asl
+echo_result(Message) <-
    .print("Resposta recebida do artefato remoto: ", Message).
```

## done

A mensagem `done` é enviada pelo runtime externo quando a operação remota termina.

Exemplo:

```json
{
  "type": "done",
  "callId": "1"
}
```

### Campos

```text
type
Valor fixo: done.

callId
Identificador da chamada concluída.
```

### Conversão para CArtAgO

O proxy Java converte essa mensagem em:

```java
signal("remote_done", "1");
```

O agente Jason pode reagir com:

```asl
+remote_done(CallId) <-
    .print("Remote operation finished. callId: ", CallId).
```

## error

A mensagem `error` é enviada quando ocorre uma falha no runtime externo ou na comunicação.

Exemplo:

```json
{
  "type": "error",
  "callId": "1",
  "code": "runtime_error",
  "message": "Unknown operation"
}
```

### Campos

```text
type
Valor fixo: error.

callId
Identificador da chamada relacionada.
Caso o erro não esteja associado a uma chamada específica, pode usar o valor unknown.

code
Código curto do erro.

message
Mensagem descritiva do erro.
```

### Conversão para CArtAgO

O proxy Java converte essa mensagem em:

```java
signal("remote_error", callId, code, message);
```

O agente Jason pode reagir com:

```asl
+remote_error(CallId, Code, Message) <-
    .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).
```

## Identificador de chamada: callId

O campo `callId` é essencial para o protocolo.

Ele permite que o proxy Java e o runtime externo saibam a qual chamada cada resposta pertence.

Isso é importante porque operações remotas podem ser assíncronas e podem gerar múltiplas respostas antes de terminar.

Por exemplo, uma futura operação `collectTweets` pode gerar:

```text
tweet(...)
reply(...)
reply(...)
reply(...)
done
```

Todas essas mensagens podem compartilhar o mesmo `callId`, indicando que pertencem à mesma chamada remota.

## Execução assíncrona

O protocolo foi desenhado para permitir execução assíncrona.

Isso significa que uma operação remota não precisa retornar apenas uma resposta única e imediata. Ela pode emitir vários sinais ao longo do tempo e finalizar depois com `done`.

Essa característica é importante para chamadas externas que podem demorar, como:

```text
requisições HTTP;
consultas a APIs externas;
análise com LLM;
coleta de dados;
operações com sensores;
processamento distribuído.
```

## Protocolo no MVP EchoArtifact

No MVP atual, o fluxo completo é:

### 1. Jason chama a operação

```asl
echo("hello from Jason").
```

### 2. Java envia operation_request

```json
{
  "type": "operation_request",
  "callId": "1",
  "artifact": "EchoArtifact",
  "operation": "echo",
  "args": {
    "message": "hello from Jason"
  }
}
```

### 3. TypeScript responde com signal

```json
{
  "type": "signal",
  "callId": "1",
  "name": "echo_result",
  "args": ["hello from Jason"]
}
```

### 4. TypeScript finaliza com done

```json
{
  "type": "done",
  "callId": "1"
}
```

### 5. Jason recebe os sinais

```text
Remote operation started: echo / callId: 1
Resposta recebida do artefato remoto: hello from Jason
Remote operation finished. callId: 1
```

## Limitações atuais

O protocolo atual é intencionalmente mínimo.

Ele ainda não contempla:

```text
propriedades observáveis;
validação automática contra o contrato;
autenticação;
reconexão automática;
múltiplos runtimes simultâneos;
mensagens binárias;
streaming avançado;
controle de timeout;
versionamento do protocolo;
tipos complexos;
geração automática de proxies.
```

Essas limitações são aceitáveis para o MVP, pois o objetivo inicial é validar o fluxo de comunicação entre JaCaMo e um runtime externo.

## Extensões futuras

As próximas versões do protocolo podem incluir:

```text
observable_property
Mensagem para atualizar propriedades observáveis CArtAgO.

operation_accepted
Mensagem para confirmar que uma operação foi aceita pelo runtime.

heartbeat
Mensagem periódica para verificar se o runtime externo continua ativo.

timeout
Representação explícita de tempo máximo de execução.

schema_validation_error
Erro específico para falhas de validação de contrato.

runtime_info
Mensagem para informar linguagem, versão e capacidades do runtime externo.
```

## Importância para o TCC

O protocolo é uma das partes centrais da proposta porque permite desacoplar JaCaMo da linguagem concreta do artefato remoto.

O JaCaMo não precisa saber se o artefato foi implementado em TypeScript, Python, Go, Rust ou outra linguagem. Ele precisa apenas que o runtime externo respeite o protocolo definido.

Assim, a arquitetura se torna independente de linguagem no nível da comunicação, ainda que cada linguagem precise implementar seu próprio runtime ou adaptador.
