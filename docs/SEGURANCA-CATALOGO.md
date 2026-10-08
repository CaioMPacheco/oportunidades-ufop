# Segurança do catálogo

As proteções do login anterior continuam válidas. Esta atualização acrescenta:

## Publicação por administradores

A regra `admin()` verifica a conta autenticada, o e-mail confirmado e o documento `administradores/{uid}` com `active: true`. Leitura do próprio documento administrativo é permitida para descobrir a interface disponível. Listagem e qualquer escrita administrativa pelo aplicativo são proibidas.

A permissão inicial é concedida pelo dono do Firebase, usando o console. O console usa permissões administrativas do projeto e não as regras do cliente. Limite quem tem acesso ao console.

Não basta esconder a aba Administração. As regras de `oportunidades` também exigem `admin()` em qualquer criação/alteração. Só permitir clicar não constitui uma autorização.

## Rascunhos

Alunos consultam somente os estados `publicada` e `encerrada`. Essa condição aparece tanto na query do React quanto nas regras, pois regras do Firestore não filtram resultados de consultas abertas.

Administradores podem ler rascunhos. O catálogo geral, inclusive para administradores, exibe só oportunidades publicadas/encerradas; use Administração para revisar rascunhos.

## Dados e links

A lista de campos de uma oportunidade é fechada. Tipos, cursos, áreas, campus, modalidade, quantidade de documentos, tamanhos de textos e timestamps são validados pelo banco. IDs de autor e data de criação são preservados na edição.

Links são validados e limitados a HTTP/HTTPS na interface. Abertura externa usa `noopener noreferrer`. Textos são renderizados pelo React sem HTML inserido pelo usuário. Isso não garante que a fonte cadastrada seja confiável: o administrador deve revisar o endereço e o conteúdo antes de publicar.

## Acompanhamento privado

Cada aluno escreve apenas em `usuarios/{seu_uid}/acompanhamentos/{oportunidade_id}`. As regras validam os estados e permitem marcar apenas documentos existentes naquela oportunidade. Os acompanhamentos não concedem acesso a publicações em rascunho.

Não há upload de CPF, currículo ou histórico. Os documentos são nomes de itens e marcações de progresso. Outro aluno, mesmo administrador do catálogo pelo aplicativo, não recebe acesso ao seu perfil/acompanhamento.

## Revogação e indisponibilidade

Revogar `active` impede novas operações administrativas autorizadas pelas regras. Conteúdo já lido não pode ser “deslido”; a interface remove o editor e recarrega apenas a consulta permitida.

Ao retirar uma publicação, mantemos o acompanhamento privado para não apagar o trabalho do aluno. Ele pode removê-lo explicitamente, com confirmação. Não há exclusão irreversível de oportunidades pelo painel.
