---
description: >-
  Un experimento de traducción de voz en tiempo real basado en una única
  sesión GPT-Live full-duplex.
metaDescription: >-
  Live Translation explora la traducción de voz semántica bidireccional con
  una única sesión GPT-Live-1, WebRTC y un límite de señalización en el
  servidor.
summary: >-
  Creé Live Translation para explorar una pregunta sencilla: ¿hasta dónde
  puede llegar un agente de voz full-duplex en una experiencia de traducción
  cuando la aplicación mantiene la orquestación al mínimo? El proyecto
  permite elegir dos idiomas, hablar en cualquiera de ellos y escuchar la
  traducción semántica en el otro.
highlights:
  - una única sesión GPT-Live-1 full-duplex mediante WebRTC
  - traducción semántica en ambas direcciones
  - creación de sesiones y negociación SDP en el servidor
  - estados explícitos del ciclo de vida y observabilidad basada en eventos amplios
---

Creé Live Translation como un experimento centrado en la interacción de voz en tiempo real. Una persona elige dos idiomas, habla en cualquiera de ellos y escucha una traducción natural en el otro. El proyecto se mantiene deliberadamente acotado porque la arquitectura es el tema principal: ¿qué debe formar parte de la aplicación y qué puede quedar dentro de un modelo en tiempo real?

## Un agente en lugar de un pipeline

Una versión anterior dividía la experiencia entre una sesión de transcripción y otra de traducción. Eso creaba un límite entre los turnos parciales y los finalizados, dos conexiones WebRTC, credenciales de cliente de corta duración y una cola para coordinar un modelo con el otro.

La versión actual utiliza una única sesión GPT-Live-1. El modelo recibe el audio del micrófono, identifica cuál de los dos idiomas configurados se ha hablado y devuelve la traducción en forma de audio. Así se reduce la sincronización que debe gestionar la aplicación y se deja en manos del modelo la parte de la interacción que es inherentemente conversacional.

Este intercambio es intencional. La aplicación tiene menos control sobre el texto intermedio, pero la sesión tiene menos piezas móviles y una superficie de fallo más pequeña.

## Un límite de señalización de confianza

El navegador gestiona el permiso para usar el micrófono y la conexión entre pares de WebRTC. El servidor recibe la oferta SDP, valida la pareja de idiomas, crea la sesión Live con la clave de API del proyecto y devuelve la respuesta SDP.

Esto mantiene explícito el límite de las credenciales sin convertir el servidor en un proxy de medios. El audio sigue circulando por la conexión WebRTC negociada, mientras que el servidor se encarga de la configuración de la sesión y de su inicialización.

La ruta también ofrece a la aplicación un único lugar desde el que observar los fallos del proveedor. Un evento amplio registra la solicitud, los idiomas seleccionados, el modelo, la duración, el resultado y metadatos seguros del proveedor, sin almacenar el SDP ni el audio.

## La traducción como contrato del agente

Los selectores de idioma no son solo controles de presentación. Se convierten en parte del contrato de sesión que se transmite al agente.

Las instrucciones definen dos direcciones: del idioma principal al secundario y del secundario al principal. También definen el límite de calidad: la respuesta debe conservar el significado, la intención, el tono, los nombres, los números y el registro, evitando una salida literal palabra por palabra. El agente recibe la instrucción de traducir únicamente, sin responder, confirmar, explicar ni iniciar una conversación normal.

Esto mantiene pequeña la política de la aplicación y hace que el comportamiento esperado sea fácil de entender en el momento en que se crea la sesión en tiempo real.

## Una interfaz centrada en el estado

La interfaz visible no muestra deliberadamente mensajes transcritos ni una ilustración reactiva del agente. Mantiene al usuario orientado mediante la pareja de idiomas seleccionada, el estado de la conexión, los controles para iniciar y terminar, y los errores.

La reproducción de audio utiliza un destino multimedia oculto. Así, la interfaz permanece discreta sin perder la interacción de voz real. También resulta más fácil razonar sobre el límite entre la superficie del producto y la implementación del transporte: el navegador expone el estado de la sesión, mientras que la conexión Live transporta la conversación.

## Un experimento con límites claros

Live Translation todavía no es un servicio público de traducción. No tiene cuentas, persistencia, grabaciones, limitación de tasa en producción ni herramientas externas. Las próximas preguntas giran en torno a la calidad de la traducción, el comportamiento ante interrupciones, la evaluación y los controles operativos necesarios para una sesión de tiempo real de pago.

Por ahora, el valor está en la arquitectura reducida: un agente, un canal de audio, un límite de señalización en el servidor y una interfaz pequeña que facilita probar el comportamiento.
