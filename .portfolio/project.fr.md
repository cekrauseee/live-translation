---
slug: live-translation
portfolioIndex: 7
name: cekrauseee/live-translation
repositoryUrl: https://github.com/cekrauseee/live-translation
description: >-
  Une expérience de traduction vocale en temps réel construite autour d'une
  seule session GPT-Live full-duplex.
metaDescription: >-
  Live Translation explore la traduction vocale sémantique bidirectionnelle
  avec une seule session GPT-Live-1, WebRTC et une frontière de signalisation
  côté serveur.
summary: >-
  J'ai créé Live Translation pour examiner une question simple : jusqu'où un
  agent vocal full-duplex peut-il porter une expérience de traduction lorsque
  l'application garde une orchestration réduite ? Le projet permet de choisir
  deux langues, de parler dans l'une ou l'autre et d'entendre la traduction
  sémantique dans l'autre.
highlights:
  - une seule session GPT-Live-1 full-duplex via WebRTC
  - une traduction sémantique dans les deux directions
  - la création de session et la négociation SDP côté serveur
  - des états de cycle de vie explicites et une observabilité fondée sur des événements larges
---

J'ai conçu Live Translation comme une expérience ciblée sur l'interaction vocale en temps réel. Une personne choisit deux langues, parle dans l'une ou l'autre et entend une traduction naturelle dans l'autre. Le projet reste volontairement limité, car l'architecture est le véritable sujet : qu'est-ce qui doit appartenir à l'application, et que peut-on laisser à un modèle temps réel ?

## Un agent plutôt qu'un pipeline

Une version précédente répartissait l'expérience entre une session de transcription et une session de traduction distincte. Cela créait une frontière entre les tours partiels et finalisés, deux connexions WebRTC, des identifiants client à courte durée de vie et une file d'attente pour coordonner un modèle avec l'autre.

La version actuelle utilise plutôt une seule session GPT-Live-1. Le modèle reçoit le son du microphone, identifie laquelle des deux langues configurées a été parlée et renvoie la traduction sous forme audio. L'application gère ainsi moins de synchronisation et confie au modèle la partie de l'interaction qui est intrinsèquement conversationnelle.

Ce compromis est intentionnel. L'application exerce moins de contrôle sur le texte intermédiaire, mais la session comporte moins d'éléments mobiles et une surface de défaillance réduite.

## Une frontière de signalisation de confiance

Le navigateur gère l'autorisation d'utiliser le microphone et la connexion pair-à-pair WebRTC. Le serveur reçoit l'offre SDP, valide la paire de langues, crée la session Live avec la clé API du projet et renvoie la réponse SDP.

Cela rend explicite la frontière des identifiants sans transformer le serveur en proxy média. Le son continue de transiter par la connexion WebRTC négociée, tandis que le serveur reste responsable de la configuration de la session et de son initialisation.

La route offre aussi à l'application un point unique pour observer les défaillances du fournisseur. Un événement large enregistre la requête, les langues sélectionnées, le modèle, la durée, le résultat et des métadonnées fournisseur non sensibles, sans conserver le SDP ni l'audio.

## La traduction comme contrat d'agent

Les sélecteurs de langue ne sont pas de simples contrôles de présentation. Ils deviennent une partie du contrat de session transmis à l'agent.

Les instructions définissent deux directions : de la langue principale vers la langue secondaire, et de la langue secondaire vers la langue principale. Elles définissent également l'exigence de qualité : la réponse doit préserver le sens, l'intention, le ton, les noms, les nombres et le registre, tout en évitant une sortie littérale mot à mot. L'agent reçoit pour consigne de traduire uniquement, sans répondre, confirmer, expliquer ni entamer une conversation normale.

Cela réduit la politique portée par l'application et rend le comportement attendu lisible au moment où la session temps réel est créée.

## Une interface centrée sur l'état

L'interface visible n'affiche volontairement ni messages transcrits ni illustration réactive de l'agent. Elle aide l'utilisateur à garder ses repères grâce à la paire de langues sélectionnée, à l'état de la connexion, aux commandes de démarrage et de fin, ainsi qu'aux erreurs.

La lecture audio utilise une sortie multimédia masquée. L'interface reste ainsi discrète tout en préservant l'interaction vocale réelle. Cela clarifie aussi la frontière entre la surface du produit et l'implémentation du transport : le navigateur expose l'état de la session, tandis que la connexion Live transporte la conversation.

## Une expérience au périmètre clairement défini

Live Translation n'est pas encore un service public de traduction. Le projet ne gère ni comptes, ni persistance, ni enregistrements, ni limitation de débit en production, ni outils externes. Les prochaines questions portent sur la qualité de la traduction, le comportement lors des interruptions, l'évaluation et les contrôles opérationnels nécessaires autour d'une session temps réel payante.

Pour l'instant, l'intérêt réside dans une architecture réduite : un agent, un chemin audio, une frontière de signalisation côté serveur et une petite interface qui rend le comportement facile à tester.
