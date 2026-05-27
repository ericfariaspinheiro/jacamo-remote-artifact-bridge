# Arquitetura — Remote Artifact Bridge

Este projeto propõe uma arquitetura de artefatos remotos para JaCaMo.

O objetivo é permitir que agentes Jason interajam com artefatos cuja lógica concreta é implementada fora do Java, preservando JaCaMo/Jason como camada de raciocínio BDI e usando CArtAgO como camada de adaptação.

A motivação principal é reduzir a dependência do desenvolvedor em relação à implementação de artefatos CArtAgO diretamente em Java. Em vez de reescrever toda a lógica de integração externa em Java, o programador pode manter essa lógica em uma linguagem mais familiar, como TypeScript, desde que ela respeite um contrato de comunicação definido pela arquitetura.

## Visão geral

A arquitetura proposta separa o sistema em três camadas principais:

```text
Camada BDI
Agentes Jason, crenças, objetivos, planos e deliberação.

Camada de adaptação
Artefatos CArtAgO em Java que atuam como proxies.

Camada externa
Runtime de artefatos implementado em outra linguagem, inicialmente TypeScript.
```

O agente Jason continua usando operações como se estivesse interagindo com um artefato CArtAgO comum. A diferença é que o artefato Java não contém a lógica de negócio. Ele apenas encaminha a operação para um runtime externo e transforma as respostas recebidas em sinais ou propriedades observáveis para o agente.

## Fluxo do MVP atual

O MVP atual valida um artefato remoto mínimo chamado `EchoArtifact`.

O fluxo de comunicação validado é:

```text
Jason Agent
   ↓
EchoProxyArtifact.java
   ↓
RemoteArtifact.java
   ↓
WebSocket / JSON
   ↓
TypeScript Artifact Runtime
   ↓
EchoArtifact.ts
   ↓
WebSocket / JSON
   ↓
CArtAgO signal(...)
   ↓
Jason Agent
```

Esse fluxo prova que um agente Jason consegue chamar uma operação em um artefato CArtAgO, essa operação pode ser enviada para um runtime externo em TypeScript, e a resposta pode retornar ao agente como uma percepção normal.

## Componentes da arquitetura

### Jason Agent

O agente Jason representa a camada BDI da aplicação.

Ele continua responsável por crenças, objetivos, planos e decisões. Para o agente, a operação remota é chamada como uma operação comum de artefato.

Exemplo:

```asl
echo("hello from Jason").
```

O agente não precisa saber que a lógica real do artefato está sendo executada fora da JVM.

### EchoProxyArtifact.java

O `EchoProxyArtifact.java` é o artefato CArtAgO específico usado no MVP.

Ele expõe a operação `echo(Message)` para o agente Jason, mas não implementa a lógica concreta do artefato. Sua função é adaptar a chamada do agente para uma chamada remota.

Em termos conceituais, ele representa a interface CArtAgO visível para o agente.

### RemoteArtifact.java

O `RemoteArtifact.java` é o proxy genérico da arquitetura.

Ele é responsável por:

```text
conectar ao runtime externo via WebSocket;
criar mensagens JSON de operação;
enviar chamadas para o runtime TypeScript;
receber mensagens remotas;
interpretar respostas do protocolo;
converter respostas em signal(...) para o CArtAgO;
notificar o agente sobre início, término ou erro da operação.
```

Esse componente é a ponte entre JaCaMo/CArtAgO e o código externo.

### TypeScript Artifact Runtime

O runtime TypeScript é a aplicação externa responsável por executar a lógica real dos artefatos.

No MVP atual, ele roda como um servidor WebSocket e recebe mensagens do tipo `operation_request`.

Ao receber uma operação, ele identifica o artefato e a operação solicitada, executa o código correspondente e devolve mensagens de resposta para o proxy Java.

### EchoArtifact.ts

O `EchoArtifact.ts` é a primeira implementação externa de artefato.

Ele recebe uma mensagem e a devolve como um sinal chamado `echo_result`.

Esse artefato é simples de propósito. Sua função é validar a comunicação entre Jason, CArtAgO, Java e TypeScript antes de evoluir para artefatos mais realistas, como análise de sentimento ou coleta de tweets.

## Protocolo de comunicação

A comunicação entre o proxy Java e o runtime TypeScript usa mensagens JSON sobre WebSocket.

O MVP atual utiliza os seguintes tipos de mensagem:

```text
operation_request
signal
done
error
```

A mensagem `operation_request` é enviada pelo proxy Java para solicitar a execução de uma operação remota.

A mensagem `signal` é enviada pelo runtime TypeScript quando deseja emitir um sinal perceptível pelo agente Jason.

A mensagem `done` indica que a operação remota foi concluída.

A mensagem `error` indica que ocorreu uma falha durante a execução da operação remota.

## Contrato de artefato

A arquitetura também introduz a ideia de contrato de artefato.

O contrato descreve a interface do artefato remoto, isto é:

```text
nome do artefato;
operações disponíveis;
argumentos esperados;
sinais que podem ser emitidos;
propriedades observáveis futuras;
erros possíveis.
```

No MVP atual, o contrato do `EchoArtifact` descreve uma operação `echo`, que recebe uma string e emite o sinal `echo_result`.

Essa ideia é central para o projeto porque separa a interface do artefato de sua implementação concreta. Assim, o artefato deixa de ser obrigatoriamente uma classe Java e passa a ser uma capacidade externa descrita por contrato.

## Validação do MVP

O MVP `EchoArtifact` validou com sucesso o fluxo completo de comunicação entre o agente Jason, o artefato CArtAgO, o proxy Java, o runtime TypeScript e o retorno da resposta ao agente.

Saída observada:

```text
Remote operation started: echo / callId: 1
Resposta recebida do artefato remoto: hello from Jason
Remote operation finished. callId: 1
```

Esse resultado confirma que um agente JaCaMo/Jason conseguiu interagir com uma lógica implementada fora do Java por meio de um artefato-proxy CArtAgO.

## Importância para o TCC

A principal contribuição desta arquitetura é demonstrar que JaCaMo pode ser preservado como camada de raciocínio BDI, enquanto a lógica concreta dos artefatos pode ser deslocada para ambientes externos.

Isso reduz a necessidade de portar código de aplicação para Java/CArtAgO e permite que desenvolvedores utilizem linguagens e ecossistemas mais adequados para integrações específicas, como TypeScript/Node.js, Python ou outras linguagens capazes de implementar o protocolo definido.

A arquitetura não substitui JaCaMo, Jason ou CArtAgO. Ela propõe uma camada de interoperabilidade para que artefatos possam ser implementados remotamente, mantendo o agente BDI como centro deliberativo do sistema.

## Estado atual

O estado atual do projeto é:

```text
JaCaMo/Jason funcionando;
EchoProxyArtifact criado com sucesso;
RemoteArtifact conectado ao runtime TypeScript;
WebSocket funcionando;
mensagens JSON sendo trocadas;
runtime TypeScript executando EchoArtifact;
resposta remota sendo convertida em signal para Jason;
agente Jason recebendo e imprimindo o resultado.
```

## Próximas etapas

As próximas etapas da arquitetura são:

```text
documentar o protocolo de comunicação;
documentar o contrato de artefato;
evoluir o EchoArtifact para um SentimentArtifact remoto;
reaproveitar a lógica TypeScript já desenvolvida no TCC;
comparar a abordagem remota com a implementação anterior em Java/CArtAgO;
avaliar ganhos de desacoplamento e limitações da solução.
```
