# Fluxo Integrado — Social Monitor Agent

Este documento descreve o fluxo integrado entre `TwitterArtifact` remoto e `SentimentArtifact` remoto no projeto Remote Artifact Bridge.

O objetivo desta etapa é demonstrar que um agente Jason pode coordenar múltiplos artefatos remotos, cada um implementado fora do Java, preservando JaCaMo/Jason como camada de raciocínio BDI e usando CArtAgO como ponte de adaptação.

## Objetivo da integração

Antes desta etapa, os artefatos remotos haviam sido validados separadamente:

```text
EchoArtifact
Valida a comunicação mínima entre Jason, CArtAgO, Java e TypeScript.

SentimentArtifact
Valida processamento remoto com estado interno, propriedades observáveis e chamada real à LLM.

TwitterArtifact
Valida integração externa real com API, coleta de tweet e emissão de múltiplos sinais.
```

A integração atual combina `TwitterArtifact` e `SentimentArtifact` em um único agente Jason.

O agente coordena o seguinte fluxo:

```text
1. Coletar tweet e replies por meio do TwitterArtifact remoto.
2. Enviar cada reply recebida para o SentimentArtifact remoto.
3. Ao final da coleta, solicitar a análise de sentimento.
4. Receber os resultados da análise como propriedades observáveis.
```

## Visão geral do fluxo

```text
social_monitor_agent.asl
   ↓
TwitterProxyArtifact.java
   ↓
RemoteArtifact.java
   ↓
TypeScript Artifact Runtime
   ↓
TwitterArtifact.ts
   ↓
TweetCollectorService.ts
   ↓
API externa de Twitter
   ↓
tweet(...) / reply(...) / replies_done
   ↓
social_monitor_agent.asl
   ↓
SentimentProxyArtifact.java
   ↓
RemoteArtifact.java
   ↓
TypeScript Artifact Runtime
   ↓
SentimentArtifact.ts
   ↓
SentimentAnalysisService.ts
   ↓
LLM externa
   ↓
analysis_count / sentiment_result / analysis_done
   ↓
social_monitor_agent.asl
```

Essa etapa demonstra que o agente Jason não apenas chama um artefato remoto isolado, mas consegue orquestrar dois artefatos externos diferentes em uma mesma tarefa.

## Arquivos envolvidos

### Agente Jason

```text
jacamo-remote-artifact-bridge/src/agt/social_monitor_agent.asl
```

Esse agente coordena o fluxo completo.

Ele acessa dois artefatos:

```text
twitter
sentiment
```

O artefato `twitter` é responsável pela coleta de tweets e replies.

O artefato `sentiment` é responsável pela análise de sentimento das replies coletadas.

### Arquivo JaCaMo

```text
jacamo-remote-artifact-bridge/remote_artifact_bridge.jcm
```

Declara o agente e os dois artefatos:

```jcm
mas remote_artifact_bridge {

    agent social_monitor_agent

    workspace main {
        artifact twitter: env.TwitterProxyArtifact
        artifact sentiment: env.SentimentProxyArtifact
    }
}
```

### Proxies Java

```text
jacamo-remote-artifact-bridge/src/main/java/env/TwitterProxyArtifact.java
jacamo-remote-artifact-bridge/src/main/java/env/SentimentProxyArtifact.java
jacamo-remote-artifact-bridge/src/main/java/env/RemoteArtifact.java
```

Os proxies específicos expõem operações CArtAgO para o agente Jason.

O `RemoteArtifact.java` executa a comunicação comum com o runtime externo.

### Runtime TypeScript

```text
artifact-runtime-ts/src/server.ts
```

Recebe mensagens `operation_request`, identifica o artefato solicitado e delega para a implementação TypeScript correta.

### Artefatos TypeScript

```text
artifact-runtime-ts/src/artifacts/TwitterArtifact.ts
artifact-runtime-ts/src/artifacts/SentimentArtifact.ts
```

`TwitterArtifact.ts` executa a coleta e emite sinais `tweet`, `reply` e `replies_done`.

`SentimentArtifact.ts` recebe replies, executa análise e emite `analysis_count`, `sentiment_result` e `analysis_done`.

### Serviços TypeScript

```text
artifact-runtime-ts/src/services/TweetCollectorService.ts
artifact-runtime-ts/src/services/SentimentAnalysisService.ts
```

`TweetCollectorService.ts` concentra a integração com a API externa de tweets.

`SentimentAnalysisService.ts` concentra a chamada à LLM externa.

## Fluxo no agente Jason

O agente começa buscando os dois artefatos no workspace e fazendo `focus` neles:

```asl
joinWorkspace("main", WspId);

lookupArtifact("twitter", TwitterId);
focus(TwitterId);

lookupArtifact("sentiment", SentimentId);
focus(SentimentId);
```

Depois, limpa qualquer estado anterior do artefato de sentimento:

```asl
clearReplies;
```

Em seguida, inicia a coleta:

```asl
collectTweets("openai").
```

Quando o `TwitterArtifact` remoto encontra um tweet, ele emite:

```asl
+tweet(Id, Text, Author, CreatedAt, Likes)
```

Quando encontra replies, ele emite:

```asl
+reply(Index, Text, Author, CreatedAt, Likes)
```

O agente reage a cada reply chamando o artefato de sentimento:

```asl
+reply(Index, Text, Author, CreatedAt, Likes) <-
    .print("Reply ", Index, ": ", Text);
    .print("Author: ", Author, " / Likes: ", Likes);
    addReply(Text).
```

Quando a coleta termina, o `TwitterArtifact` emite:

```asl
+replies_done
```

O agente então solicita a análise de sentimento:

```asl
+replies_done <-
    .print("Replies collection finished.");
    .print("Starting sentiment analysis...");
    .wait(1000);
    analyze.
```

O resultado da análise chega ao agente como propriedades observáveis:

```asl
+analysis_count(Count)
+sentiment_result(Index, Sentiment)
```

E a conclusão chega como sinal:

```asl
+analysis_done
```

## Mensagens geradas pelo TwitterArtifact

A operação remota de coleta é iniciada por:

```asl
collectTweets("openai").
```

O proxy Java envia ao runtime TypeScript:

```json
{
  "type": "operation_request",
  "callId": "1",
  "artifact": "TwitterArtifact",
  "operation": "collectTweets",
  "args": {
    "username": "openai"
  }
}
```

O runtime TypeScript pode responder com:

```json
{
  "type": "signal",
  "callId": "1",
  "name": "tweet",
  "args": [
    "2061564502160892138",
    "Texto do tweet",
    "OpenAI",
    "Mon Jun 01 21:44:13 +0000 2026",
    1984
  ]
}
```

E para cada reply:

```json
{
  "type": "signal",
  "callId": "1",
  "name": "reply",
  "args": [
    1,
    "I love this announcement",
    "mock_user_1",
    "Mon Jun 01 21:44:13 +0000 2026",
    12
  ]
}
```

Ao final:

```json
{
  "type": "signal",
  "callId": "1",
  "name": "replies_done",
  "args": []
}
```

```json
{
  "type": "done",
  "callId": "1"
}
```

## Mensagens geradas pelo SentimentArtifact

Cada reply recebida pelo agente é enviada para o artefato de sentimento com:

```asl
addReply(Text).
```

O proxy envia:

```json
{
  "type": "operation_request",
  "callId": "2",
  "artifact": "SentimentArtifact",
  "operation": "addReply",
  "args": {
    "text": "I love this announcement"
  }
}
```

Após receber `replies_done`, o agente chama:

```asl
analyze.
```

O proxy envia:

```json
{
  "type": "operation_request",
  "callId": "5",
  "artifact": "SentimentArtifact",
  "operation": "analyze",
  "args": {}
}
```

O runtime TypeScript responde com propriedades observáveis:

```json
{
  "type": "observable_property",
  "callId": "5",
  "name": "analysis_count",
  "args": [3]
}
```

```json
{
  "type": "observable_property",
  "callId": "5",
  "name": "sentiment_result",
  "args": [1, "positive"]
}
```

Ao final:

```json
{
  "type": "signal",
  "callId": "5",
  "name": "analysis_done",
  "args": []
}
```

```json
{
  "type": "done",
  "callId": "5"
}
```

## Validação realizada

A integração foi validada com sucesso.

O agente conseguiu:

```text
usar o TwitterArtifact remoto;
coletar tweet e replies;
receber múltiplos sinais reply(...);
enviar cada reply para o SentimentArtifact remoto;
executar análise de sentimento com LLM;
receber analysis_count;
receber sentiment_result;
receber analysis_done.
```

Esse resultado comprova que múltiplos artefatos externos podem ser coordenados por um agente Jason.

## Importância para o TCC

Essa etapa é a prova mais forte da arquitetura até o momento.

Ela demonstra que:

```text
JaCaMo/Jason continua sendo o centro deliberativo;
CArtAgO continua sendo usado como interface de artefato;
a lógica concreta dos artefatos roda fora do Java;
o runtime externo pode usar TypeScript, APIs externas e LLMs;
o agente Jason consegue orquestrar múltiplas capacidades remotas;
os resultados retornam como percepções comuns para o agente.
```

Isso reforça a tese de que não é necessário portar toda a lógica de integração para Java/CArtAgO para que JaCaMo consiga utilizar essas capacidades.

A arquitetura permite reaproveitar código e ecossistemas externos, mantendo a camada BDI em Jason.

## Limitações observadas

Durante os testes com o `TwitterArtifact`, foram observadas limitações externas à arquitetura:

```text
a API de Twitter pode exigir créditos;
a API pode aplicar limite de uma requisição a cada cinco segundos;
o resultado depende da disponibilidade e formato da API externa;
algumas execuções podem precisar de delay maior entre chamadas;
o teste pode usar fallback mockado quando a API não estiver disponível.
```

Essas limitações não invalidam a arquitetura, pois pertencem ao serviço externo utilizado na prova de conceito.

A arquitetura em si conseguiu encaminhar a chamada, receber respostas e entregar os sinais ao agente Jason.

## Possíveis melhorias

Próximas melhorias para esse fluxo:

```text
controlar melhor a ordem entre coleta e análise;
armazenar replies com metadados no SentimentArtifact;
associar sentiment_result ao autor e ao texto original;
criar um resumo final no agente Jason;
detectar campanha negativa quando houver muitas replies negativas;
melhorar tratamento de erros da API externa;
adicionar timeout para operações remotas;
adicionar validação automática contra contratos;
gerar proxies Java a partir dos contratos.
```

## Conclusão

O fluxo integrado confirma que o Remote Artifact Bridge não funciona apenas para exemplos isolados.

Ele permite que um agente Jason coordene artefatos remotos diferentes, cada um com uma responsabilidade própria, usando TypeScript e serviços externos para executar a lógica concreta.

Esse resultado consolida a proposta central do projeto:

```text
JaCaMo/Jason permanece como camada BDI.
CArtAgO atua como ponte de interoperabilidade.
Artefatos externos implementam a lógica real em outra linguagem.
O agente recebe os resultados como sinais e propriedades observáveis.
```
