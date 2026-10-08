# Etapa 2 — Catálogo, acompanhamento e administração

Esta atualização continua seu projeto já configurado. Ela não inclui `.env`, não troca o projeto Firebase, não apaga contas e não envia e-mails de oportunidades.

## 1. Atualizar os arquivos no VS Code

1. Pare `npm run dev` com Ctrl+C.
2. Faça um commit da versão atual para preservar seu trabalho.
3. Extraia este ZIP. Copie `web/src/App.tsx` para o mesmo caminho do seu projeto, substituindo o anterior.
4. Copie a pasta `web/src/features/catalogo` para dentro de `web/src/features/` (crie `features` se ainda não existir).
5. Copie `web/src/lib/opportunities.ts` para a pasta `web/src/lib/`.
6. Substitua o `firestore.rules` da raiz pelo novo arquivo.

**Preserve seu `.env`, `src/lib/firebase.ts`, `src/lib/profile.ts`, `App.css`, `main.tsx`, `package.json` e demais configurações.** Esta atualização usa as dependências já instaladas. O App.tsx incluído parte da versão anterior que entreguei; se você personalizou esse arquivo, revise o diff para manter seus ajustes.

## 2. Publicar as novas regras

No Console Firebase, abra Firestore Database > Regras. Copie todo o novo `firestore.rules` e clique em Publicar. Ele preserva a proteção dos perfis e acrescenta as coleções de oportunidades, administradores e acompanhamentos. Publicar regras não apaga os documentos existentes.

Não basta salvar o arquivo no VS Code. As regras precisam estar publicadas no mesmo projeto indicado em seu `.env`.

## 3. Dar acesso administrativo à sua conta

O acesso administrativo é concedido manualmente pelo proprietário do projeto no console. O site não oferece um botão para um aluno se tornar administrador.

1. Em Firebase Authentication > Usuários, copie o UID da sua conta (o identificador longo, não o e-mail).
2. Em Firestore Database > Dados, clique em Iniciar coleção.
3. Nome da coleção: `administradores` (exatamente assim).
4. ID do documento: cole o UID da sua conta. Não use ID automático.
5. Adicione o campo `active`, tipo **boolean**, valor **true**.
6. Salve. Sua conta precisa ter e-mail confirmado e perfil concluído.

O documento fica em `administradores/SEU_UID`. Ele tem somente a configuração administrativa necessária. Não coloque `admin:true` no documento `usuarios/SEU_UID`.

Para revogar a permissão, altere `active` para **false** no console. A interface acompanha essa mudança; as regras também consultam a permissão ao autorizar gravações.

## 4. Executar

Dentro de `web`:

```bash
npm run dev
```

Entre com sua conta. Agora, depois de concluir o perfil, você verá:

- **Explorar:** catálogo com busca por texto e filtros por tipo, campus e curso.
- **Minhas oportunidades:** suas oportunidades salvas, incluindo encerradas.
- **Administração:** disponível somente para contas autorizadas.
- **Meu perfil:** acesso ao perfil e aos interesses da etapa anterior.

## 5. Cadastrar a primeira oportunidade

Abra Administração > Nova oportunidade. Preencha título, organização, tipo, campus, modalidade, prazo, descrição, requisitos, documentos e fonte oficial. A remuneração e o link específico de inscrição são opcionais.

- **Cursos:** nenhum marcado significa todos os cursos.
- **Áreas:** nenhuma marcada significa conteúdo geral.
- **Prazo:** sempre no horário de Brasília, independentemente do fuso do seu computador. O instante é salvo como Timestamp no banco.
- **Documentos:** um por linha, até 15 itens.
- **Rascunho:** visível apenas aos administradores.
- **Publicada:** visível aos alunos; o prazo deve estar no futuro ao salvar.
- **Encerrada:** visível nos acompanhamentos e quando o filtro de encerradas estiver ativo.

O site não cria oportunidades fictícias automaticamente. Para testar sem uma oportunidade real, use título explícito como “TESTE — oportunidade fictícia”, deixe como rascunho inicialmente e use uma conta/projeto de testes antes de mostrar a estudantes.

As inscrições com prazo vencido aparecem como encerradas automaticamente na interface, sem alterar o documento. Ao editar uma publicação já vencida, mude o estado para Encerrada ou corrija o prazo antes de salvar.

Para retirar uma publicação do catálogo, edite e volte a situação para Rascunho. Acompanhamentos existentes permanecem salvos; o aluno verá que a oportunidade ficou indisponível. Não há exclusão permanente de oportunidades nesta etapa.

## 6. Testar como aluno

1. Use uma segunda conta, com e-mail confirmado e perfil concluído, sem documento em `administradores`.
2. Confirme que a aba Administração não aparece.
3. Confira que rascunhos não aparecem no catálogo.
4. Abra uma oportunidade publicada e clique em Salvar e iniciar checklist.
5. Marque documentos e altere a situação para Preparando documentos.
6. Recarregue e confira se as marcações foram mantidas.
7. Teste busca sem acentos, filtros e “Combina com meu perfil”.
8. Volte à conta administrativa e edite os documentos. As marcações dos documentos que continuam na lista são mantidas; itens removidos não contam mais no progresso.
9. Encerre a oportunidade e confira que ela continua em Minhas oportunidades.

“Inscrição realizada” é um registro manual do aluno; clicar no link externo não marca inscrição automaticamente. A checklist armazena marcações, sem receber documentos pessoais.

## Como a recomendação funciona

O filtro usa o curso informado, os tipos escolhidos e a interseção das áreas de interesse. Ele não confirma requisitos como notas, período mínimo ou disponibilidade. O texto sempre orienta a conferir o edital.

O campus é um filtro manual nesta versão, pois o perfil anterior não armazena campus. Não inferimos campus a partir do curso.

## Limites desta etapa

- Não há disparo de e-mails de oportunidades. Consentimento e frequência da etapa anterior continuam preservados.
- Não há coleta automática de sites nem integração com MinhaUFOP.
- Para o MVP, o catálogo carrega as oportunidades publicadas/encerradas em tempo real e filtra no navegador. Antes de uma base grande, planeje paginação, índices e busca no backend para limitar leituras.
- Conflitos simultâneos na edição administrativa seguem a última gravação; revise o conteúdo ao trabalhar com mais de um editor.

Consulte `docs/SEGURANCA-CATALOGO.md` e `VERIFICACAO.md` para segurança e validação.
