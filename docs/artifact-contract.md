# Contrato de Artefato — Remote Artifact Bridge

Este documento descreve o conceito de contrato de artefato utilizado no projeto Remote Artifact Bridge.

O contrato de artefato é uma descrição explícita da interface de um artefato remoto. Ele define quais operações o artefato oferece, quais argumentos essas operações recebem e quais sinais ou propriedades observáveis podem ser produzidos como resultado.

A ideia central é separar a interface do artefato de sua implementação concreta.

## Objetivo do contrato

Em JaCaMo/CArtAgO tradicional, um artefato costuma ser implementado diretamente como uma classe Java.

Neste projeto, a proposta é permitir que a lógica concreta do artefato seja implementada fora do Java, por exemplo em TypeScript, Python, Go, Rust ou outra linguagem capaz de respeitar o protocolo de comunicação.

Para isso, é necessário definir um contrato que descreva o que o artefato faz, independentemente da linguagem em que ele foi implementado.

O contrato responde perguntas como:

```text
Qual é o nome do artefato?
Quais operações ele oferece?
Quais argumentos cada operação recebe?
Quais sinais ele pode emitir?
Quais propriedades observáveis ele pode atualizar?
Quais erros podem acontecer?
Qual transporte de comunicação ele utiliza?
```

## Importância conceitual

O contrato é uma das abstrações centrais do projeto.

Ele permite que o artefato deixe de ser visto apenas como uma classe Java e passe a ser visto como uma capacidade externa descrita por interface.

Essa mudança é importante porque reduz o acoplamento entre JaCaMo e Java.

Em vez de obrigar o desenvolvedor a reescrever toda a lógica de integração como um artefato CArtAgO em Java, a arquitetura permite que essa lógica seja implementada em outra linguagem, desde que o artefato remoto respeite o contrato definido.

## Contrato atual do EchoArtifact

O MVP atual utiliza um contrato simples para o `EchoArtifact`.

```json
{
  "name": "EchoArtifact",
  "runtime": "remote",
  "transport": "websocket",
  "operations": [
    {
      "name": "echo",
      "args": [
        {
          "name": "message",
          "type": "string"
        }
      ],
      "signals": [
        {
          "name": "echo_result",
          "args": ["string"]
        }
      ]
    }
  ]
}
```

Esse contrato define que existe um artefato remoto chamado `EchoArtifact`.

Ele possui uma operação chamada `echo`, que recebe um argumento chamado `message` do tipo `string`.

Como resultado, o artefato pode emitir um sinal chamado `echo_result`, também contendo uma string.

## Campos do contrato

### name

O campo `name` define o nome do artefato remoto.

Exemplo:

```json
"name": "EchoArtifact"
```

Esse nome é usado pelo proxy Java para identificar qual artefato remoto deve receber a operação.

No MVP atual, o `EchoProxyArtifact.java` envia chamadas para o artefato remoto chamado `EchoArtifact`.

## runtime

O campo `runtime` define como o artefato será executado.

No MVP atual:

```json
"runtime": "remote"
```

Isso indica que a lógica do artefato não está dentro do processo JaCaMo, mas em um runtime externo.

No futuro, outros valores poderiam ser utilizados, como:

```text
remote
wasm
graalvm
java
```

Esses valores permitiriam que a mesma ideia de contrato fosse usada com diferentes estratégias de execução.

## transport

O campo `transport` define o mecanismo de comunicação utilizado entre o proxy Java e o runtime externo.

No MVP atual:

```json
"transport": "websocket"
```

Isso significa que o proxy CArtAgO e o runtime TypeScript se comunicam por mensagens JSON enviadas via WebSocket.

No futuro, outros transportes poderiam ser usados, como:

```text
grpc
http
tcp
unix-socket
message-broker
```

## operations

O campo `operations` lista as operações oferecidas pelo artefato.

Cada operação representa uma ação que o agente Jason pode solicitar por meio do artefato CArtAgO.

Exemplo:

```json
{
  "name": "echo",
  "args": [
    {
      "name": "message",
      "type": "string"
    }
  ]
}
```

Nesse caso, a operação se chama `echo` e recebe um argumento chamado `message`.

## args

O campo `args` descreve os argumentos esperados por uma operação.

Cada argumento possui:

```text
name
Nome do argumento.

type
Tipo esperado do argumento.
```

No MVP atual, os tipos são simples. Exemplo:

```json
{
  "name": "message",
  "type": "string"
}
```

Tipos simples esperados nesta fase:

```text
string
number
boolean
string[]
number[]
object
```

A tipagem ainda não é validada automaticamente pelo proxy Java. Por enquanto, ela funciona como documentação e como base para futuras validações.

## signals

O campo `signals` descreve os sinais que o artefato remoto pode emitir.

Exemplo:

```json
{
  "name": "echo_result",
  "args": ["string"]
}
```

Esse trecho indica que o artefato pode emitir o sinal `echo_result` com um argumento do tipo `string`.

No runtime TypeScript, esse sinal é enviado como uma mensagem JSON:

```json
{
  "type": "signal",
  "callId": "1",
  "name": "echo_result",
  "args": ["hello from Jason"]
}
```

O proxy Java converte essa mensagem para um `signal(...)` do CArtAgO, perceptível pelo agente Jason.

## observableProperties

O MVP atual ainda não utiliza propriedades observáveis, mas o contrato poderá incluí-las em versões futuras.

Exemplo futuro:

```json
{
  "observableProperties": [
    {
      "name": "sentiment_result",
      "args": ["number", "string"]
    }
  ]
}
```

Esse campo será útil para artefatos como `SentimentArtifact`, que podem produzir resultados persistentes ou consultáveis pelo agente.

## errors

O contrato também poderá declarar erros esperados.

Exemplo futuro:

```json
{
  "errors": [
    "runtime_error",
    "timeout",
    "invalid_arguments",
    "external_api_failure"
  ]
}
```

Isso permitirá que o agente Jason trate falhas de forma mais explícita.

## Relação entre contrato e protocolo

O contrato e o protocolo têm papéis diferentes.

O contrato descreve a interface do artefato.

O protocolo descreve as mensagens trocadas entre o proxy Java e o runtime externo.

Em outras palavras:

```text
Contrato:
Define o que o artefato oferece.

Protocolo:
Define como a comunicação acontece.
```

Exemplo:

```text
Contrato:
EchoArtifact possui operação echo(message: string).

Protocolo:
Essa chamada será enviada como uma mensagem JSON operation_request.
```

## Relação entre contrato e proxy CArtAgO

O proxy CArtAgO é a ponte entre o agente Jason e o artefato remoto.

No MVP atual, o contrato ainda não é usado automaticamente para gerar código. Porém, ele já define a interface que o proxy deve respeitar.

No futuro, o contrato poderá ser usado para gerar automaticamente proxies Java.

Por exemplo, a partir do contrato do `EchoArtifact`, uma ferramenta poderia gerar:

```java
public class EchoProxyArtifact extends RemoteArtifact {
    @OPERATION
    public void echo(String message) {
        JSONObject args = new JSONObject();
        args.put("message", message);

        invokeRemote("EchoArtifact", "echo", args);
    }
}
```

Essa possibilidade é importante porque reduz ainda mais a necessidade de escrever código Java manualmente.

## Relação com independência de linguagem

A arquitetura não permite que JaCaMo execute automaticamente qualquer linguagem.

O que ela permite é que qualquer linguagem capaz de implementar o protocolo de comunicação possa atuar como runtime de artefatos remotos.

Isso significa que a independência de linguagem ocorre no nível do contrato e do protocolo.

Um artefato remoto pode ser implementado em TypeScript, Python, Go, Rust ou outra linguagem, desde que consiga:

```text
receber mensagens JSON;
interpretar operation_request;
executar a operação solicitada;
enviar signal, done ou error;
respeitar a interface descrita pelo contrato.
```

## Exemplo de uso no MVP

No MVP atual, o contrato declara:

```text
Artefato:
EchoArtifact

Operação:
echo(message: string)

Sinal produzido:
echo_result(string)
```

O agente Jason chama:

```asl
echo("hello from Jason").
```

O proxy Java envia:

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

O runtime TypeScript executa a operação e responde:

```json
{
  "type": "signal",
  "callId": "1",
  "name": "echo_result",
  "args": ["hello from Jason"]
}
```

O agente Jason percebe:

```asl
+echo_result(Message)
```

## Limitações atuais

O contrato atual é simples e ainda não possui:

```text
validação automática de tipos;
geração automática de proxies;
versionamento;
descrição formal de erros;
descrição formal de propriedades observáveis;
suporte a tipos complexos;
autenticação;
metadados de runtime;
restrições de timeout;
múltiplos transportes.
```

Essas limitações são aceitáveis para o MVP, pois a primeira etapa do projeto tem como objetivo validar o fluxo de comunicação.

## Extensões futuras

Futuramente, o contrato poderá evoluir para incluir:

```text
schema JSON formal;
validação em tempo de inicialização;
geração automática de classes proxy em Java;
geração de tipos para TypeScript;
suporte a múltiplos backends de execução;
descrição de propriedades observáveis;
descrição de eventos assíncronos;
versionamento de contrato;
documentação automática.
```

## Importância para o TCC

O contrato de artefato reforça a contribuição conceitual do projeto.

Ele mostra que a proposta não é apenas enviar mensagens por WebSocket, mas sim criar uma camada de interoperabilidade baseada em interfaces explícitas.

A partir desse contrato, JaCaMo pode interagir com artefatos remotos sem depender diretamente da linguagem em que a lógica concreta foi implementada.

Assim, a proposta contribui para reduzir a dor de adaptação de aplicações externas para JaCaMo, mantendo Jason como camada BDI e deslocando a lógica de integração para linguagens mais adequadas ao contexto do desenvolvedor.
