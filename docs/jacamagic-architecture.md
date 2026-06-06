# JaCaMagic — Arquitetura do MagicArtifact Bridge

Este documento descreve a arquitetura atual do **JaCaMagic**, uma proposta de ponte dinâmica entre agentes Jason/JaCaMo e runtimes externos implementados em outras linguagens de programação.

A arquitetura recebeu o nome de **MagicArtifact Bridge** porque sua ideia central é fornecer ao usuário um único artefato genérico, chamado `MagicArtifact`, capaz de descobrir operações externas em tempo de execução e disponibilizá-las ao agente Jason como se fossem operações comuns de artefatos CArtAgO.

## 1. Visão geral

O JaCaMagic tem como objetivo eliminar a necessidade de o usuário aprender Java para criar artefatos em JaCaMo.

Em um projeto JaCaMo tradicional, o desenvolvedor normalmente precisa escrever:

```text
1. O comportamento do agente em Jason.
2. Os artefatos e integrações externas em Java/CArtAgO.
```

O problema é que Java se torna uma barreira adicional. Mesmo que o usuário esteja disposto a aprender Jason para programar agentes BDI, ele ainda precisa aprender Java para integrar o agente com APIs, serviços externos, bancos de dados, LLMs, sensores ou outras aplicações.

O JaCaMagic propõe uma alternativa:

```text
O usuário continua programando o agente em Jason.
A lógica externa do artefato pode ser implementada em outra linguagem.
Um único artefato Java genérico faz a ponte entre os dois mundos.
```

No estágio atual, a linguagem externa usada na prova de conceito é **TypeScript**, mas a arquitetura não depende exclusivamente dela. Qualquer linguagem poderia ser usada no futuro, desde que implemente o protocolo esperado.

## 2. Ideia central

A ideia central é substituir artefatos Java específicos por um único artefato genérico:

```jcm
artifact twitter: env.MagicArtifact("localhost", 8080, "TwitterArtifact")
artifact sentiment: env.MagicArtifact("localhost", 8080, "SentimentArtifact")
```

Em vez de o usuário criar classes como:

```text
TwitterProxyArtifact.java
SentimentProxyArtifact.java
EchoProxyArtifact.java
```

ele usa sempre:

```text
env.MagicArtifact
```

Esse artefato recebe informações mínimas:

```text
host;
porta;
nome do artefato remoto desejado.
```

A partir disso, o `MagicArtifact` conecta-se ao runtime externo, solicita o manifesto do artefato remoto, descobre quais operações estão disponíveis e registra essas operações dinamicamente no CArtAgO.

## 3. Diferença em relação à versão anterior

Antes da evolução para o JaCaMagic, a arquitetura funcionava com proxies Java específicos.

Exemplo:

```jcm
artifact twitter: env.TwitterProxyArtifact
artifact sentiment: env.SentimentProxyArtifact
```

Cada proxy Java continha métodos anotados com `@OPERATION`, como:

```java
@OPERATION
public void collectTweets(String username) {
    JSONObject args = new JSONObject();
    args.put("username", username);

    invokeRemote("TwitterArtifact", "collectTweets", args);
}
```

Essa abordagem já reduzia a dor de portar a lógica real para Java, porque o código TypeScript era reaproveitado. Porém, ainda existia uma limitação importante: para cada artefato novo, era necessário criar ou gerar um proxy Java específico.

Com o `MagicArtifact`, essa necessidade é removida. O runtime externo informa as operações disponíveis por meio de um manifesto, e o `MagicArtifact` registra essas operações dinamicamente.

## 4. Arquitetura geral

O fluxo geral da arquitetura é:

```text
Agente Jason
   ↓
MagicArtifact genérico
   ↓
WebSocket / JSON
   ↓
Runtime externo
   ↓
Implementação real do artefato
   ↓
WebSocket / JSON
   ↓
signals / observable properties
   ↓
Agente Jason
```

Mais detalhadamente:

```text
1. O arquivo .jcm cria uma instância de env.MagicArtifact.
2. O MagicArtifact conecta-se ao runtime externo via WebSocket.
3. O MagicArtifact envia uma mensagem runtime_hello.
4. O runtime externo responde com artifact_manifest.
5. O MagicArtifact lê as operações descritas no manifesto.
6. O MagicArtifact registra essas operações dinamicamente usando defineOp.
7. O agente Jason chama essas operações normalmente.
8. O MagicArtifact transforma a chamada em operation_request.
9. O runtime externo executa a lógica real.
10. O runtime devolve signal, observable_property, done ou error.
11. O MagicArtifact converte as mensagens em percepções para o agente.
```

## 5. Componentes principais

### 5.1 MagicArtifact

O `MagicArtifact` é o componente central da arquitetura.

Ele é uma classe Java fornecida pela infraestrutura JaCaMagic, não pelo usuário final.

Responsabilidades:

```text
conectar ao runtime externo;
enviar runtime_hello;
receber artifact_manifest;
registrar operations dinamicamente;
mapear argumentos Jason para JSON;
enviar operation_request;
receber respostas remotas;
emitir signals;
definir observable properties;
limpar observable properties;
sinalizar done e error.
```

O usuário não precisa alterar essa classe para cada cenário.

### 5.2 Runtime externo

O runtime externo é o processo responsável por executar a lógica real dos artefatos.

Na prova de conceito atual, ele é implementado em TypeScript e roda como servidor WebSocket.

Ele contém:

```text
server.ts;
EchoArtifact.ts;
TwitterArtifact.ts;
SentimentArtifact.ts;
TweetCollectorService.ts;
SentimentAnalysisService.ts.
```

O runtime recebe mensagens JSON do `MagicArtifact` e responde também com mensagens JSON.

### 5.3 Artifact manifest

O manifesto é a descrição da interface de um artefato remoto.

Ele informa:

```text
nome do artefato;
operações disponíveis;
argumentos de cada operação;
signals que podem ser emitidos;
observable properties que podem ser criadas.
```

Exemplo de manifesto do `SentimentArtifact`:

```json
{
  "type": "artifact_manifest",
  "artifact": "SentimentArtifact",
  "operations": [
    { "name": "clearReplies", "args": [] },
    { "name": "clearResults", "args": [] },
    {
      "name": "addReply",
      "args": [{ "name": "text", "type": "string" }]
    },
    { "name": "analyze", "args": [] }
  ],
  "signals": [
    { "name": "analysis_done", "args": [] }
  ],
  "observableProperties": [
    { "name": "analysis_count", "args": ["number"] },
    { "name": "sentiment_result", "args": ["number", "string"] }
  ]
}
```

### 5.4 Operações dinâmicas

As operações descritas no manifesto são registradas dinamicamente pelo `MagicArtifact`.

Isso significa que o Java não precisa ter métodos como:

```java
@OPERATION
public void analyze() { ... }
```

Em vez disso, o `MagicArtifact` usa a API do CArtAgO para criar operações em tempo de inicialização.

Exemplo conceitual:

```text
Manifesto informa:
addReply(text: string)

MagicArtifact registra:
addReply/1

Jason chama:
addReply("This is terrible")
```

Quando o Jason chama a operação, o `MagicArtifact` monta uma mensagem:

```json
{
  "type": "operation_request",
  "callId": "3",
  "artifact": "SentimentArtifact",
  "operation": "addReply",
  "args": {
    "text": "This is terrible"
  }
}
```

Essa mensagem é enviada ao runtime externo.

## 6. Protocolo de comunicação

A comunicação entre Java e runtime externo é feita por JSON via WebSocket.

Os principais tipos de mensagem são:

```text
runtime_hello
artifact_manifest
operation_request
signal
observable_property
clear_observable_properties
done
error
```

### 6.1 runtime_hello

Mensagem enviada pelo `MagicArtifact` ao runtime externo para solicitar o manifesto de um artefato específico.

```json
{
  "type": "runtime_hello",
  "protocolVersion": "1.0",
  "artifact": "TwitterArtifact"
}
```

### 6.2 artifact_manifest

Mensagem enviada pelo runtime externo ao `MagicArtifact`, descrevendo as operações disponíveis.

```json
{
  "type": "artifact_manifest",
  "artifact": "TwitterArtifact",
  "operations": [
    {
      "name": "collectTweets",
      "args": [{ "name": "username", "type": "string" }]
    }
  ],
  "signals": [
    { "name": "tweet", "args": ["string", "string", "string", "string", "number"] },
    { "name": "reply", "args": ["number", "string", "string", "string", "number"] },
    { "name": "replies_done", "args": [] }
  ],
  "observableProperties": []
}
```

### 6.3 operation_request

Mensagem enviada pelo `MagicArtifact` ao runtime externo quando o agente Jason chama uma operação dinâmica.

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

### 6.4 signal

Mensagem enviada pelo runtime externo para emitir um sinal perceptível pelo agente Jason.

```json
{
  "type": "signal",
  "callId": "1",
  "name": "reply",
  "args": [1, "This is terrible", "user123", "2026-06-01", 10]
}
```

O `MagicArtifact` converte isso em:

```java
signal("reply", 1, "This is terrible", "user123", "2026-06-01", 10);
```

O agente Jason percebe:

```asl
+reply(Index, Text, Author, Time, Likes)
```

### 6.5 observable_property

Mensagem enviada pelo runtime externo para definir uma propriedade observável no artefato.

```json
{
  "type": "observable_property",
  "callId": "35",
  "name": "sentiment_result",
  "args": [1, "negative"]
}
```

O `MagicArtifact` converte isso em:

```java
defineObsProperty("sentiment_result", 1, "negative");
```

O agente Jason percebe:

```asl
+sentiment_result(Index, Sentiment)
```

### 6.6 clear_observable_properties

Mensagem usada para remover propriedades observáveis antigas.

```json
{
  "type": "clear_observable_properties",
  "callId": "35",
  "name": "sentiment_result"
}
```

O `MagicArtifact` remove as propriedades observáveis com aquele nome antes de novos resultados serem definidos.

### 6.7 done

Mensagem enviada quando uma operação remota termina.

```json
{
  "type": "done",
  "callId": "35"
}
```

O `MagicArtifact` emite:

```asl
+remote_done(CallId)
```

### 6.8 error

Mensagem enviada quando ocorre erro no runtime externo.

```json
{
  "type": "error",
  "callId": "35",
  "code": "runtime_error",
  "message": "Unknown operation"
}
```

O `MagicArtifact` emite:

```asl
+remote_error(CallId, Code, Message)
```

## 7. Exemplo de uso no arquivo .jcm

A versão atual permite declarar duas instâncias do mesmo artefato genérico:

```jcm
mas remote_artifact_bridge {

    agent magic_social_monitor_agent

    workspace main {
        artifact twitter: env.MagicArtifact("localhost", 8080, "TwitterArtifact")
        artifact sentiment: env.MagicArtifact("localhost", 8080, "SentimentArtifact")
    }
}
```

Nesse exemplo:

```text
twitter
usa o manifesto do TwitterArtifact e registra collectTweets/1.

sentiment
usa o manifesto do SentimentArtifact e registra clearReplies/0, clearResults/0, addReply/1 e analyze/0.
```

O usuário não precisa criar `TwitterProxyArtifact.java` nem `SentimentProxyArtifact.java`.

## 8. Exemplo de agente Jason

O agente pode usar as operações normalmente:

```asl
currentUser("openai").

!start.

+!start
   <- joinWorkspace("main", WspId);

      lookupArtifact("twitter", TwitterId);
      focus(TwitterId);

      lookupArtifact("sentiment", SentimentId);
      focus(SentimentId);

      clearReplies;
      clearResults;

      ?currentUser(User);
      collectTweets(User).

+reply(Index, Text, Author, Time, Likes)
   <- addReply(Text).

+replies_done
   <- .wait(2000);
      analyze.

+sentiment_result(Index, Sentiment)
   <- .print("Sentiment result ", Index, ": ", Sentiment).

+analysis_done
   <- .print("Sentiment analysis finished.").
```

Do ponto de vista do Jason, as operações parecem operações normais de artefato:

```text
collectTweets
clearReplies
clearResults
addReply
analyze
```

Mas nenhuma delas existe como método Java específico.

## 9. Validações realizadas

### 9.1 Fase 1 — operação dinâmica local

Foi validado que o `MagicArtifact` consegue registrar uma operação `echo/1` dinamicamente usando `defineOp`, sem existir método Java anotado com `@OPERATION`.

```text
Jason chamou echo("hello from JaCaMagic")
MagicArtifact executou a operação dinâmica
Jason recebeu echo_result
```

### 9.2 Fase 2 — manifesto local

Foi validado que o `MagicArtifact` consegue ler um manifesto local e registrar operações a partir dele.

```text
Manifesto local declarou echo/1
MagicArtifact registrou echo/1
Jason chamou echo("hello from manifest")
Jason recebeu echo_result
```

### 9.3 Fase 3 — manifesto via WebSocket

Foi validado que o `MagicArtifact` consegue conectar-se ao runtime TypeScript, enviar `runtime_hello`, receber `artifact_manifest`, registrar a operação `echo/1` e encaminhar a chamada para o runtime externo.

```text
MagicArtifact conectou ao runtime externo
Runtime enviou manifesto remoto
MagicArtifact registrou echo/1
Jason chamou echo("hello from remote manifest")
TypeScript executou EchoArtifact
Jason recebeu echo_result
```

### 9.4 Fase 4 — SentimentArtifact com MagicArtifact

Foi validado que o `SentimentProxyArtifact.java` não é mais necessário.

O `.jcm` usou:

```jcm
artifact sentiment: env.MagicArtifact("localhost", 8080, "SentimentArtifact")
```

O runtime enviou o manifesto do `SentimentArtifact`, e o `MagicArtifact` registrou dinamicamente:

```text
clearReplies/0
clearResults/0
addReply/1
analyze/0
```

Resultado:

```text
Jason chamou clearReplies, clearResults, addReply e analyze
TypeScript executou análise de sentimento com LLM
Jason recebeu analysis_count, sentiment_result e analysis_done
```

### 9.5 Fase 5 — TwitterArtifact com MagicArtifact

Foi validado que o `TwitterProxyArtifact.java` não é mais necessário.

O `.jcm` usou:

```jcm
artifact twitter: env.MagicArtifact("localhost", 8080, "TwitterArtifact")
```

O runtime enviou o manifesto do `TwitterArtifact`, e o `MagicArtifact` registrou dinamicamente:

```text
collectTweets/1
```

Resultado:

```text
Jason chamou collectTweets("openai")
TypeScript coletou tweet e replies
Jason recebeu tweet, reply e replies_done
```

### 9.6 Fase 6 — integração Twitter + Sentiment com duas instâncias de MagicArtifact

Foi validado o cenário completo com duas instâncias do mesmo artefato genérico:

```jcm
artifact twitter: env.MagicArtifact("localhost", 8080, "TwitterArtifact")
artifact sentiment: env.MagicArtifact("localhost", 8080, "SentimentArtifact")
```

Resultado validado:

```text
TwitterArtifact coletou replies
SentimentArtifact recebeu replies
LLM classificou sentimentos
Jason processou resultados
Jason gerou resumo final
```

Exemplo de resumo final obtido:

```text
RESUMO FINAL
Positivos: 7
Negativos: 12
Neutros: 1
```

## 10. Contribuição principal

A principal contribuição do JaCaMagic é demonstrar que é possível oferecer ao usuário um único artefato Java genérico, capaz de descobrir operações externas e disponibilizá-las dinamicamente ao agente Jason.

A proposta desloca a complexidade da integração externa para o runtime remoto, permitindo que o usuário escreva integrações em linguagens mais familiares, como TypeScript ou Python, sem precisar criar artefatos Java específicos.

Em termos práticos, a arquitetura evolui de:

```text
Um proxy Java por artefato externo.
```

para:

```text
Um único MagicArtifact reutilizável para diferentes artefatos externos.
```

## 11. O que o usuário ainda precisa fazer

Na versão atual, o usuário ainda precisa:

```text
declarar o MagicArtifact no .jcm;
informar host, porta e nome do artefato remoto;
implementar o runtime externo;
garantir que o runtime externo responda com o manifesto correto;
programar o agente em Jason.
```

O usuário não precisa:

```text
criar TwitterProxyArtifact.java;
criar SentimentProxyArtifact.java;
criar métodos Java @OPERATION;
portar lógica de API ou LLM para Java.
```

## 12. Limitações atuais

### 12.1 Sincronização assíncrona

O fluxo ainda usa esperas simples em alguns pontos, por exemplo:

```asl
.wait(2000);
analyze.
```

Isso funciona para a prova de conceito, mas a versão final deveria ter uma sincronização mais robusta.

### 12.2 Colisão de nomes de operações

Se duas instâncias de `MagicArtifact` estiverem focadas ao mesmo tempo e ambas expuserem uma operação com o mesmo nome, pode haver ambiguidade.

Possíveis soluções futuras:

```text
uso de namespaces;
aliases no manifesto;
controle mais explícito de focus;
chamada qualificada por artifact id;
validação de colisões no início da execução.
```

### 12.3 Validação de tipos ainda simples

O `MagicArtifact` já valida tipos básicos, como:

```text
string;
number;
boolean;
object.
```

Mas ainda não há validação formal por JSON Schema.

### 12.4 Manifestos ainda definidos manualmente no runtime

Atualmente, os manifestos são criados no `server.ts`.

Possível evolução:

```text
carregar manifestos de arquivos JSON;
associar automaticamente classes TypeScript a manifestos;
validar se a implementação realmente possui as operações declaradas.
```

### 12.5 Transporte fixo em WebSocket

A prova de conceito usa WebSocket.

Possíveis evoluções:

```text
gRPC;
HTTP;
TCP puro;
Unix sockets;
message brokers.
```

### 12.6 Segurança e autenticação

A versão atual não possui autenticação entre o `MagicArtifact` e o runtime externo.

Possível evolução:

```text
tokens;
chaves compartilhadas;
TLS;
controle de origem;
permissões por operação.
```

## 13. Próximas evoluções

As próximas evoluções naturais são:

```text
1. Consolidar o formato de artifact_manifest.
2. Criar JSON Schema para validação de manifestos.
3. Organizar os manifestos em arquivos separados.
4. Adicionar suporte formal a observable properties no manifesto.
5. Melhorar sincronização entre operações remotas.
6. Implementar namespaces ou aliases de operação.
7. Criar templates de runtime para TypeScript e Python.
8. Criar um gerador de projeto JaCaMagic.
9. Integrar a opção JaCaMagic ao fluxo de criação de projetos.
10. Avaliar desempenho e latência da comunicação.
```

## 14. Comparação com a abordagem tradicional

### 14.1 Abordagem tradicional

```text
Usuário escreve agente em Jason.
Usuário escreve artefato em Java.
Artefato Java usa @OPERATION.
Artefato Java implementa integração externa.
```

Problema:

```text
O usuário precisa aprender Java e CArtAgO para criar integrações externas.
```

### 14.2 Abordagem com proxies específicos

```text
Usuário escreve agente em Jason.
Proxy Java específico encaminha chamadas.
Runtime externo executa a lógica real.
```

Melhoria:

```text
A lógica externa não precisa ser portada para Java.
```

Limitação:

```text
Ainda existe um proxy Java específico por artefato.
```

### 14.3 Abordagem JaCaMagic

```text
Usuário escreve agente em Jason.
Usuário declara env.MagicArtifact no .jcm.
Runtime externo informa operações por manifesto.
MagicArtifact registra operações dinamicamente.
Runtime externo executa a lógica real.
```

Melhoria:

```text
O usuário não precisa criar artefatos Java específicos.
```

## 15. Conclusão

O JaCaMagic demonstra a viabilidade de uma ponte dinâmica entre agentes Jason/JaCaMo e runtimes externos.

A principal inovação da arquitetura é o `MagicArtifact`, um artefato CArtAgO genérico que recebe um manifesto remoto, registra operações dinamicamente e encaminha chamadas para um runtime externo.

Com isso, o usuário pode continuar aprendendo e programando o comportamento do agente em Jason, enquanto implementa a lógica dos artefatos em linguagens mais familiares, como TypeScript.

A prova de conceito validou:

```text
operações dinâmicas locais;
operações descritas por manifesto local;
manifesto remoto via WebSocket;
substituição do SentimentProxyArtifact;
substituição do TwitterProxyArtifact;
integração completa Twitter + Sentiment com duas instâncias de MagicArtifact.
```

O resultado final confirma que a proposta é tecnicamente viável:

```text
um único artefato Java genérico pode ser oferecido ao usuário;
as operações podem ser descobertas em runtime;
e o agente Jason pode usá-las como operações naturais.
```
