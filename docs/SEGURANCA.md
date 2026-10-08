# Como a segurança funciona

## 1. Autenticação: quem é o usuário?

`web/src/lib/firebase.ts` inicializa o Firebase Authentication. O `App.tsx` usa as funções oficiais `createUserWithEmailAndPassword` e `signInWithEmailAndPassword`. A senha é entregue ao serviço de autenticação por conexão segura; ela não é gravada em documentos do Firestore, logs ou arquivos da aplicação. Não implementamos hash MD5, criptografia caseira ou uma tabela de senhas.

O Firebase gerencia o armazenamento protegido de credenciais e emite tokens de autenticação. A presença de um nome digitado ou de um valor em armazenamento local nunca é usada como prova de identidade.

A senha permanece no estado React somente enquanto é digitada e é limpa após uma autenticação bem-sucedida ou troca de modo. Em caso de erro, permanece para permitir correção. Isso não equivale a persistência no banco.

## 2. Autorização: quais dados essa identidade pode acessar?

O ID do documento é o UID atribuído pelo Firebase: `usuarios/{uid}`. As regras exigem `request.auth.uid == uid`. O aluno A não pode ler nem alterar o perfil do aluno B, mesmo chamando o Firestore diretamente sem usar a interface.

A lista de campos aceita é fechada. Não existe campo `admin` ou `role` editável pelo estudante. Curso, áreas, tipos, tamanho do nome, booleanos e timestamps são validados nas regras. Consultas listando usuários são bloqueadas. Outras coleções são bloqueadas por padrão.

**Publicar as regras é obrigatório.** O arquivo em seu GitHub não protege o banco enquanto não for publicado no projeto Firebase correto. Ocultar botões no React não substitui regras de autorização.

## 3. Verificação e política de senha

O usuário pode criar seu perfil básico antes de confirmar o e-mail. A conclusão do questionário e alterações no perfil exigem e-mail confirmado também nas regras do Firestore (`email_verified`). Ao voltar do link de confirmação, o código recarrega o usuário e força a atualização do token antes de continuar.

A interface exige senha de 12 a 128 caracteres com maiúscula, minúscula, número e símbolo. Configure os mesmos requisitos no Firebase Authentication com a opção Exigir para que não possam ser contornados por uma requisição direta.

Mensagens de falha de login/cadastro são genéricas. Na recuperação, a interface não confirma se a conta existe. Habilite a proteção de enumeração do próprio Firebase: texto genérico sozinho não bloqueia consultas diretas à API. O provedor aplica suas proteções e quotas; o código trata tentativas excessivas. Isso não é promessa de proteção absoluta contra abuso.

## 4. Sessão e execução no navegador

Usamos `browserSessionPersistence`: a sessão é mantida na aba durante sua sessão, em vez de implementar um “lembrar de mim” permanente. O SDK gerencia seus tokens; nosso código não manipula seu armazenamento. O botão Sair encerra a sessão. Uma aplicação publicada deve usar HTTPS.

React renderiza os textos do usuário como texto, sem `dangerouslySetInnerHTML`. Isso reduz a possibilidade de transformar nomes em HTML executável. Qualquer token acessível ao JavaScript continua exposto se houver uma vulnerabilidade XSS; mantenha dependências atualizadas, limite scripts de terceiros e configure uma política de conteúdo na hospedagem de produção. A fonte externa do CSS é opcional e pode ser removida para servir tudo localmente.

## 5. Configuração pública não é segredo de servidor

Os valores do Firebase Web em `VITE_` ficam visíveis no código entregue ao navegador. A proteção dos registros vem de Authentication e Security Rules, e não de esconder o `apiKey`. O `.env` separa ambientes, mas não torna o bundle secreto.

Credenciais administrativas, conta de serviço e chaves de envio de e-mail jamais devem ser colocadas no frontend. SDKs administrativos ignoram as regras do Firestore; qualquer backend futuro deverá verificar tokens, permissões e entradas por conta própria.

## 6. Preferências de e-mail

A autorização para avisos começa desmarcada, é opcional e pode ser revogada. A escolha e a data da alteração são persistidas. Não há coleta de CPF, histórico acadêmico, documentos ou senha da MinhaUFOP.

Não há envio de oportunidades nesta versão. O remetente futuro deverá checar novamente consentimento e endereço verificado em cada disparo, limitar frequência e oferecer descadastro. Não permitir que o cliente defina destinatários ou conteúdo de uma fila pública de envio.

## 7. Limites da entrega

O código não substitui auditoria de segurança. Antes de liberar a aplicação a estudantes, valide com Firebase real e teste as regras usando contas distintas ou o Emulator Suite: anônimo bloqueado; usuário A bloqueado no UID de B; alteração com `admin:true` bloqueada; curso inválido bloqueado; alteração sem confirmação de e-mail bloqueada; alteração válida do próprio perfil permitida.

Também planeje App Check nos serviços suportados, monitoramento de abuso/quotas, rotina de exclusão de conta e dados, política de privacidade e revisão de acessos administrativos. Essas medidas futuras não estão implementadas silenciosamente nesta entrega.
