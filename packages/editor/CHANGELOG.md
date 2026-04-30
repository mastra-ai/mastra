# @mastra/editor

## 0.7.22

### Patch Changes

- Fix MCP client support in the agent editor: ([#15945](https://github.com/mastra-ai/mastra/pull/15945))
  - MCP client form dirty state: Save button now enables after adding/removing MCP clients
  - MCP tool name matching: Both bare and namespaced tool names are matched correctly
  - Auth token forwarding: Token from cookie or header is forwarded to auth-protected MCP servers
  - String interpolation: Request context variables in system prompts now resolve correctly
- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8), [`4b2e4f3`](https://github.com/mastra-ai/mastra/commit/4b2e4f3bc9f5a63dcbfccfa54f9474340c3cea58)]:
  - @mastra/core@1.30.0
  - @mastra/memory@1.17.4

## 0.7.22-alpha.1

### Patch Changes

- Fix MCP client support in the agent editor: ([#15945](https://github.com/mastra-ai/mastra/pull/15945))
  - MCP client form dirty state: Save button now enables after adding/removing MCP clients
  - MCP tool name matching: Both bare and namespaced tool names are matched correctly
  - Auth token forwarding: Token from cookie or header is forwarded to auth-protected MCP servers
  - String interpolation: Request context variables in system prompts now resolve correctly
- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0-alpha.1

## 0.7.22-alpha.0

### Patch Changes

- Updated dependencies [[`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`4b2e4f3`](https://github.com/mastra-ai/mastra/commit/4b2e4f3bc9f5a63dcbfccfa54f9474340c3cea58)]:
  - @mastra/core@1.29.2-alpha.0
  - @mastra/memory@1.17.4-alpha.0

## 0.7.21

### Patch Changes

- Fixed template variable interpolation for arrays and objects. Previously, using {{products}} where products is an array of objects would render as [object Object],[object Object]. Now arrays and objects are automatically JSON-stringified, so {{products}} correctly renders the full JSON representation. ([#15927](https://github.com/mastra-ai/mastra/pull/15927))

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`95b001f`](https://github.com/mastra-ai/mastra/commit/95b001f750af6947ad9d174cd47abffc776663a5), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1
  - @mastra/memory@1.17.3

## 0.7.21-alpha.1

### Patch Changes

- Fixed template variable interpolation for arrays and objects. Previously, using {{products}} where products is an array of objects would render as [object Object],[object Object]. Now arrays and objects are automatically JSON-stringified, so {{products}} correctly renders the full JSON representation. ([#15927](https://github.com/mastra-ai/mastra/pull/15927))

## 0.7.21-alpha.0

### Patch Changes

- Updated dependencies [[`95b001f`](https://github.com/mastra-ai/mastra/commit/95b001f750af6947ad9d174cd47abffc776663a5)]:
  - @mastra/memory@1.17.3-alpha.0

## 0.7.20

### Patch Changes

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`10e1c9a`](https://github.com/mastra-ai/mastra/commit/10e1c9a6a99c14eb055d0f409b603e07af827e68), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`8c39f81`](https://github.com/mastra-ai/mastra/commit/8c39f815c7d06f2cd11bb099a72805a20f2ab755), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0
  - @mastra/mcp@1.6.0
  - @mastra/memory@1.17.2

## 0.7.20-alpha.0

### Patch Changes

- Updated dependencies [[`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`10e1c9a`](https://github.com/mastra-ai/mastra/commit/10e1c9a6a99c14eb055d0f409b603e07af827e68), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`ec4cb26`](https://github.com/mastra-ai/mastra/commit/ec4cb26919972eb2031fea510f8f013e1d5b7ee2), [`8c39f81`](https://github.com/mastra-ai/mastra/commit/8c39f815c7d06f2cd11bb099a72805a20f2ab755)]:
  - @mastra/core@1.29.0-alpha.6
  - @mastra/mcp@1.6.0-alpha.0
  - @mastra/memory@1.17.2-alpha.0

## 0.7.19

### Patch Changes

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`e20a3d2`](https://github.com/mastra-ai/mastra/commit/e20a3d2cda9b94ca6625519da2e6492c335bd009), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0
  - @mastra/memory@1.17.1
  - @mastra/mcp@1.5.2

## 0.7.19-alpha.0

### Patch Changes

- Updated dependencies [[`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9)]:
  - @mastra/core@1.28.0-alpha.1
  - @mastra/memory@1.17.1-alpha.0

## 0.7.18

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c), [`6e9ab07`](https://github.com/mastra-ai/mastra/commit/6e9ab07b7120e0f4ed1e117c45db0f94840f4afd)]:
  - @mastra/core@1.27.0
  - @mastra/memory@1.17.0

## 0.7.18-alpha.0

### Patch Changes

- Updated dependencies [[`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c), [`6e9ab07`](https://github.com/mastra-ai/mastra/commit/6e9ab07b7120e0f4ed1e117c45db0f94840f4afd)]:
  - @mastra/core@1.27.0-alpha.1
  - @mastra/memory@1.17.0-alpha.0

## 0.7.17

### Patch Changes

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`7db42a9`](https://github.com/mastra-ai/mastra/commit/7db42a9cccd3b29c44fb0731f792c51575e8421c), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`3a347a9`](https://github.com/mastra-ai/mastra/commit/3a347a95c563df027d082bcc82ddc31b88410744), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`c65aec3`](https://github.com/mastra-ai/mastra/commit/c65aec356cc037ee7c4b30ccea946807d4c4f443), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0
  - @mastra/schema-compat@1.2.9
  - @mastra/memory@1.16.0
  - @mastra/mcp@1.5.1

## 0.7.17-alpha.4

### Patch Changes

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`3a347a9`](https://github.com/mastra-ai/mastra/commit/3a347a95c563df027d082bcc82ddc31b88410744), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12
  - @mastra/memory@1.16.0-alpha.4

## 0.7.17-alpha.3

### Patch Changes

- Updated dependencies [[`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9)]:
  - @mastra/core@1.26.0-alpha.10
  - @mastra/memory@1.16.0-alpha.3

## 0.7.17-alpha.2

### Patch Changes

- Updated dependencies [[`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3)]:
  - @mastra/core@1.26.0-alpha.4
  - @mastra/memory@1.16.0-alpha.2

## 0.7.17-alpha.1

### Patch Changes

- Updated dependencies [[`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`7db42a9`](https://github.com/mastra-ai/mastra/commit/7db42a9cccd3b29c44fb0731f792c51575e8421c), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653)]:
  - @mastra/core@1.26.0-alpha.3
  - @mastra/schema-compat@1.2.9-alpha.1
  - @mastra/mcp@1.5.1-alpha.1
  - @mastra/memory@1.16.0-alpha.1

## 0.7.17-alpha.0

### Patch Changes

- Updated dependencies [[`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c65aec3`](https://github.com/mastra-ai/mastra/commit/c65aec356cc037ee7c4b30ccea946807d4c4f443)]:
  - @mastra/core@1.26.0-alpha.2
  - @mastra/memory@1.16.0-alpha.0
  - @mastra/schema-compat@1.2.9-alpha.0
  - @mastra/mcp@1.5.1-alpha.1

## 0.7.16

### Patch Changes

- Resolving stored agent versions no longer mutates the shared singleton agent instance. Instruction and tool overrides are now applied to an isolated clone, making concurrent version resolution safe and preventing overrides from leaking onto the global agent. ([#15314](https://github.com/mastra-ai/mastra/pull/15314))

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6), [`5cf84a3`](https://github.com/mastra-ai/mastra/commit/5cf84a3e2b7aa69b3f674a6f312f1bf0ed7ebead), [`2a69802`](https://github.com/mastra-ai/mastra/commit/2a69802a0fc6d8a25a77fa6a42276e9d59a83914), [`5f3d4dd`](https://github.com/mastra-ai/mastra/commit/5f3d4ddf237241f4b238ac062ac61eadabed0770), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0
  - @mastra/memory@1.15.1
  - @mastra/mcp@1.5.0
  - @mastra/schema-compat@1.2.8

## 0.7.16-alpha.2

### Patch Changes

- Resolving stored agent versions no longer mutates the shared singleton agent instance. Instruction and tool overrides are now applied to an isolated clone, making concurrent version resolution safe and preventing overrides from leaking onto the global agent. ([#15314](https://github.com/mastra-ai/mastra/pull/15314))

- Updated dependencies [[`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`5f3d4dd`](https://github.com/mastra-ai/mastra/commit/5f3d4ddf237241f4b238ac062ac61eadabed0770), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0-alpha.3
  - @mastra/mcp@1.5.0-alpha.0

## 0.7.16-alpha.1

### Patch Changes

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`2a69802`](https://github.com/mastra-ai/mastra/commit/2a69802a0fc6d8a25a77fa6a42276e9d59a83914)]:
  - @mastra/core@1.25.0-alpha.2
  - @mastra/schema-compat@1.2.8-alpha.0
  - @mastra/mcp@1.4.2
  - @mastra/memory@1.15.1-alpha.1

## 0.7.16-alpha.0

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6)]:
  - @mastra/core@1.24.2-alpha.0
  - @mastra/memory@1.15.1-alpha.0

## 0.7.15

### Patch Changes

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`60b7d4a`](https://github.com/mastra-ai/mastra/commit/60b7d4a428c6caeca94f4740978359bb40c4ab37), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`f308d62`](https://github.com/mastra-ai/mastra/commit/f308d6206a083eeaccbca782be062c57076935d7), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`6f714ec`](https://github.com/mastra-ai/mastra/commit/6f714ec9a5614222761fd6ea3d53af1da9ab6034), [`98209a0`](https://github.com/mastra-ai/mastra/commit/98209a03c35c5479c25cca26ee0c63eff81e6d74), [`2bdb5fd`](https://github.com/mastra-ai/mastra/commit/2bdb5fd887bfd81bdb71c4a5db22a4fda99f2591)]:
  - @mastra/core@1.24.0
  - @mastra/memory@1.15.0
  - @mastra/mcp@1.4.2

## 0.7.15-alpha.3

### Patch Changes

- Updated dependencies [[`60b7d4a`](https://github.com/mastra-ai/mastra/commit/60b7d4a428c6caeca94f4740978359bb40c4ab37)]:
  - @mastra/memory@1.15.0-alpha.3

## 0.7.15-alpha.2

### Patch Changes

- Updated dependencies [[`6f714ec`](https://github.com/mastra-ai/mastra/commit/6f714ec9a5614222761fd6ea3d53af1da9ab6034), [`2bdb5fd`](https://github.com/mastra-ai/mastra/commit/2bdb5fd887bfd81bdb71c4a5db22a4fda99f2591)]:
  - @mastra/memory@1.15.0-alpha.2
  - @mastra/mcp@1.4.2-alpha.1

## 0.7.15-alpha.1

### Patch Changes

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1
  - @mastra/memory@1.15.0-alpha.1

## 0.7.15-alpha.0

### Patch Changes

- Updated dependencies [[`f308d62`](https://github.com/mastra-ai/mastra/commit/f308d6206a083eeaccbca782be062c57076935d7)]:
  - @mastra/memory@1.15.0-alpha.0

## 0.7.14

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`a4c0c78`](https://github.com/mastra-ai/mastra/commit/a4c0c78264013624e5fe369f9a27aa25f3401012), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`aced936`](https://github.com/mastra-ai/mastra/commit/aced93644d7544ef631c530b960ba1278dcef7f4), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0
  - @mastra/memory@1.14.0

## 0.7.14-alpha.2

### Patch Changes

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`aced936`](https://github.com/mastra-ai/mastra/commit/aced93644d7544ef631c530b960ba1278dcef7f4), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8
  - @mastra/memory@1.14.0-alpha.2

## 0.7.14-alpha.1

### Patch Changes

- Updated dependencies [[`a4c0c78`](https://github.com/mastra-ai/mastra/commit/a4c0c78264013624e5fe369f9a27aa25f3401012), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440)]:
  - @mastra/memory@1.14.0-alpha.1
  - @mastra/core@1.23.0-alpha.4

## 0.7.14-alpha.0

### Patch Changes

- Updated dependencies [[`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a)]:
  - @mastra/core@1.23.0-alpha.0
  - @mastra/memory@1.13.2-alpha.0

## 0.7.13

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0
  - @mastra/memory@1.13.1

## 0.7.13-alpha.0

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
  - @mastra/memory@1.13.1-alpha.0

## 0.7.12

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`5467a87`](https://github.com/mastra-ai/mastra/commit/5467a87090d6359980344c443737c059afe5cc11), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0
  - @mastra/memory@1.13.0

## 0.7.12-alpha.0

### Patch Changes

- Updated dependencies [[`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`5467a87`](https://github.com/mastra-ai/mastra/commit/5467a87090d6359980344c443737c059afe5cc11)]:
  - @mastra/core@1.21.0-alpha.1
  - @mastra/memory@1.13.0-alpha.0

## 0.7.11

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0
  - @mastra/memory@1.12.1
  - @mastra/mcp@1.4.1

## 0.7.11-alpha.0

### Patch Changes

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0-alpha.0
  - @mastra/memory@1.12.1-alpha.0
  - @mastra/mcp@1.4.1-alpha.0

## 0.7.10

### Patch Changes

- Code-defined agents no longer get overridden with draft version data when no version has been explicitly published. When requesting `published` status and no `activeVersionId` is set, the agent's code defaults are preserved instead of falling back to the latest draft. ([#14894](https://github.com/mastra-ai/mastra/pull/14894))

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`25bbff6`](https://github.com/mastra-ai/mastra/commit/25bbff67dadc01d5a18095574421f6266f610b17), [`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`542977f`](https://github.com/mastra-ai/mastra/commit/542977fe5043678df071ad3982b6bcbc78d95f02), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`d2d0bea`](https://github.com/mastra-ai/mastra/commit/d2d0beaafba2e25b9ad368015ce91312c372f6a5), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c), [`66a7412`](https://github.com/mastra-ai/mastra/commit/66a7412ec0550f3dfa01cd05b057d8c6e5b062bc)]:
  - @mastra/core@1.19.0
  - @mastra/memory@1.12.0
  - @mastra/mcp@1.4.0

## 0.7.10-alpha.1

### Patch Changes

- Code-defined agents no longer get overridden with draft version data when no version has been explicitly published. When requesting `published` status and no `activeVersionId` is set, the agent's code defaults are preserved instead of falling back to the latest draft. ([#14894](https://github.com/mastra-ai/mastra/pull/14894))

- Updated dependencies [[`542977f`](https://github.com/mastra-ai/mastra/commit/542977fe5043678df071ad3982b6bcbc78d95f02), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`d2d0bea`](https://github.com/mastra-ai/mastra/commit/d2d0beaafba2e25b9ad368015ce91312c372f6a5)]:
  - @mastra/memory@1.12.0-alpha.1
  - @mastra/core@1.19.0-alpha.2

## 0.7.10-alpha.0

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`25bbff6`](https://github.com/mastra-ai/mastra/commit/25bbff67dadc01d5a18095574421f6266f610b17)]:
  - @mastra/core@1.18.1-alpha.0
  - @mastra/memory@1.11.1-alpha.0

## 0.7.9

### Patch Changes

- Changed default agent version resolution from draft to published. Execution endpoints now use the latest published agent version by default instead of the draft version. ([#14847](https://github.com/mastra-ai/mastra/pull/14847))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`0dbaab9`](https://github.com/mastra-ai/mastra/commit/0dbaab988103f27495c37fd820f03a632eab2c59), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`1662721`](https://github.com/mastra-ai/mastra/commit/1662721aac59ad048b5df80323bdfb836fccbbfe), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`dd668a0`](https://github.com/mastra-ai/mastra/commit/dd668a0e4d6b3fd75cbe780028b578f0ac0ec635), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0
  - @mastra/memory@1.11.0
  - @mastra/mcp@1.3.2

## 0.7.9-alpha.5

### Patch Changes

- Changed default agent version resolution from draft to published. Execution endpoints now use the latest published agent version by default instead of the draft version. ([#14847](https://github.com/mastra-ai/mastra/pull/14847))

- Updated dependencies [[`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a)]:
  - @mastra/core@1.18.0-alpha.5

## 0.7.9-alpha.4

### Patch Changes

- Updated dependencies [[`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`dd668a0`](https://github.com/mastra-ai/mastra/commit/dd668a0e4d6b3fd75cbe780028b578f0ac0ec635), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0-alpha.3
  - @mastra/memory@1.11.0-alpha.4

## 0.7.9-alpha.3

### Patch Changes

- Updated dependencies [[`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`0dbaab9`](https://github.com/mastra-ai/mastra/commit/0dbaab988103f27495c37fd820f03a632eab2c59), [`1662721`](https://github.com/mastra-ai/mastra/commit/1662721aac59ad048b5df80323bdfb836fccbbfe), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0)]:
  - @mastra/core@1.18.0-alpha.1
  - @mastra/memory@1.10.1-alpha.3

## 0.7.9-alpha.2

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7)]:
  - @mastra/core@1.18.0-alpha.0
  - @mastra/memory@1.10.1-alpha.2

## 0.7.9-alpha.1

### Patch Changes

- Updated dependencies [[`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d)]:
  - @mastra/memory@1.10.1-alpha.1
  - @mastra/core@1.16.1-alpha.1

## 0.7.9-alpha.0

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`d657856`](https://github.com/mastra-ai/mastra/commit/d6578561c104fecfeb3caa17dc07d1acbeeffff7)]:
  - @mastra/core@1.16.1-alpha.0
  - @mastra/memory@1.10.1-alpha.0

## 0.7.8

### Patch Changes

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`47358d9`](https://github.com/mastra-ai/mastra/commit/47358d960bb2b931321de7e798f341ab0df81f44), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6), [`23bd359`](https://github.com/mastra-ai/mastra/commit/23bd359c50898c3b28b9ee25ce47c12614da5a36)]:
  - @mastra/core@1.16.0
  - @mastra/schema-compat@1.2.7
  - @mastra/memory@1.10.0
  - @mastra/mcp@1.3.1

## 0.7.8-alpha.2

### Patch Changes

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4
  - @mastra/memory@1.10.0-alpha.2

## 0.7.8-alpha.1

### Patch Changes

- Updated dependencies [[`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`47358d9`](https://github.com/mastra-ai/mastra/commit/47358d960bb2b931321de7e798f341ab0df81f44), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124)]:
  - @mastra/core@1.16.0-alpha.3
  - @mastra/schema-compat@1.2.7-alpha.1
  - @mastra/mcp@1.3.1
  - @mastra/memory@1.9.1-alpha.1

## 0.7.8-alpha.0

### Patch Changes

- Updated dependencies [[`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`23bd359`](https://github.com/mastra-ai/mastra/commit/23bd359c50898c3b28b9ee25ce47c12614da5a36)]:
  - @mastra/core@1.16.0-alpha.2
  - @mastra/schema-compat@1.2.7-alpha.0
  - @mastra/memory@1.9.1-alpha.0
  - @mastra/mcp@1.3.1

## 0.7.7

### Patch Changes

- Added version query parameters to GET /api/agents/:agentId endpoint. Code-defined agents can now be resolved with specific stored config versions using ?status=draft (latest, default), ?status=published (active version), or ?versionId=<id> (specific version). ([#14156](https://github.com/mastra-ai/mastra/pull/14156))

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`b71bce1`](https://github.com/mastra-ai/mastra/commit/b71bce144912ed33f76c52a94e594988a649c3e1), [`44df54a`](https://github.com/mastra-ai/mastra/commit/44df54a28e6315d9699cf437e4f3e8c7c7d10217), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`56c9ad9`](https://github.com/mastra-ai/mastra/commit/56c9ad9c871d258af9da4d6e50065b01d339bf34), [`0773d08`](https://github.com/mastra-ai/mastra/commit/0773d089859210217702d3175ad4b2f3d63d267e), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`cd7b568`](https://github.com/mastra-ai/mastra/commit/cd7b568fe427b1b4838abe744fa5367a47539db3), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`6a8f1e6`](https://github.com/mastra-ai/mastra/commit/6a8f1e66272d2928351db334da091ee27e304c23), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0), [`aa664b2`](https://github.com/mastra-ai/mastra/commit/aa664b218c15d397598c71194a8603b5b5a691bb), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0
  - @mastra/memory@1.9.0
  - @mastra/schema-compat@1.2.6
  - @mastra/mcp@1.3.1

## 0.7.7-alpha.2

### Patch Changes

- Updated dependencies [[`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`44df54a`](https://github.com/mastra-ai/mastra/commit/44df54a28e6315d9699cf437e4f3e8c7c7d10217), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/memory@1.9.0-alpha.2
  - @mastra/core@1.15.0-alpha.4
  - @mastra/mcp@1.3.1-alpha.1

## 0.7.7-alpha.1

### Patch Changes

- Updated dependencies [[`cd7b568`](https://github.com/mastra-ai/mastra/commit/cd7b568fe427b1b4838abe744fa5367a47539db3), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`aa664b2`](https://github.com/mastra-ai/mastra/commit/aa664b218c15d397598c71194a8603b5b5a691bb)]:
  - @mastra/schema-compat@1.2.6-alpha.1
  - @mastra/core@1.15.0-alpha.1
  - @mastra/memory@1.9.0-alpha.1
  - @mastra/mcp@1.3.1-alpha.0

## 0.7.7-alpha.0

### Patch Changes

- Added version query parameters to GET /api/agents/:agentId endpoint. Code-defined agents can now be resolved with specific stored config versions using ?status=draft (latest, default), ?status=published (active version), or ?versionId=<id> (specific version). ([#14156](https://github.com/mastra-ai/mastra/pull/14156))

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`b71bce1`](https://github.com/mastra-ai/mastra/commit/b71bce144912ed33f76c52a94e594988a649c3e1), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`56c9ad9`](https://github.com/mastra-ai/mastra/commit/56c9ad9c871d258af9da4d6e50065b01d339bf34), [`0773d08`](https://github.com/mastra-ai/mastra/commit/0773d089859210217702d3175ad4b2f3d63d267e), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`6a8f1e6`](https://github.com/mastra-ai/mastra/commit/6a8f1e66272d2928351db334da091ee27e304c23), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0)]:
  - @mastra/core@1.15.0-alpha.0
  - @mastra/schema-compat@1.2.6-alpha.0
  - @mastra/mcp@1.3.1-alpha.0
  - @mastra/memory@1.8.4-alpha.0

## 0.7.6

### Patch Changes

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`bbcbbce`](https://github.com/mastra-ai/mastra/commit/bbcbbce4f0e268053cbb11ca58350f5ceba15498), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`4a7ce05`](https://github.com/mastra-ai/mastra/commit/4a7ce05125b8d3d260f68f1fc4a6c6866d22ba24), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`247c353`](https://github.com/mastra-ai/mastra/commit/247c3531fa01d1af1014843729f0fba7d3acc953), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`b92d0c9`](https://github.com/mastra-ai/mastra/commit/b92d0c92ecc833bec9a99af98b3243839c1661be), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`133ef20`](https://github.com/mastra-ai/mastra/commit/133ef20c39c696eb0dbbee26e77c8acfec14b8c6), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e)]:
  - @mastra/core@1.14.0
  - @mastra/mcp@1.3.0
  - @mastra/schema-compat@1.2.5
  - @mastra/memory@1.8.3

## 0.7.6-alpha.2

### Patch Changes

- Updated dependencies [[`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`247c353`](https://github.com/mastra-ai/mastra/commit/247c3531fa01d1af1014843729f0fba7d3acc953), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0-alpha.3
  - @mastra/memory@1.8.3-alpha.2

## 0.7.6-alpha.1

### Patch Changes

- Updated dependencies [[`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`b92d0c9`](https://github.com/mastra-ai/mastra/commit/b92d0c92ecc833bec9a99af98b3243839c1661be), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`133ef20`](https://github.com/mastra-ai/mastra/commit/133ef20c39c696eb0dbbee26e77c8acfec14b8c6), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e)]:
  - @mastra/core@1.14.0-alpha.2
  - @mastra/memory@1.8.3-alpha.1
  - @mastra/mcp@1.3.0-alpha.1

## 0.7.6-alpha.0

### Patch Changes

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`bbcbbce`](https://github.com/mastra-ai/mastra/commit/bbcbbce4f0e268053cbb11ca58350f5ceba15498), [`4a7ce05`](https://github.com/mastra-ai/mastra/commit/4a7ce05125b8d3d260f68f1fc4a6c6866d22ba24), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1)]:
  - @mastra/core@1.13.3-alpha.0
  - @mastra/mcp@1.2.2-alpha.0
  - @mastra/schema-compat@1.2.5-alpha.0
  - @mastra/memory@1.8.3-alpha.0

## 0.7.5

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071), [`1978bc4`](https://github.com/mastra-ai/mastra/commit/1978bc424dbb04f5f7c5d8522f07f1166006fa3f)]:
  - @mastra/core@1.13.2
  - @mastra/schema-compat@1.2.4
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.2

## 0.7.5-alpha.0

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071), [`1978bc4`](https://github.com/mastra-ai/mastra/commit/1978bc424dbb04f5f7c5d8522f07f1166006fa3f)]:
  - @mastra/core@1.13.2-alpha.0
  - @mastra/schema-compat@1.2.4-alpha.0
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.2-alpha.0

## 0.7.4

### Patch Changes

- Updated dependencies [[`c4e600e`](https://github.com/mastra-ai/mastra/commit/c4e600e39a04309c3a7ff182bd806ab2b3c788ea), [`205e76c`](https://github.com/mastra-ai/mastra/commit/205e76c3ba652205dafb037f50a4a8eea73f6736)]:
  - @mastra/schema-compat@1.2.3
  - @mastra/core@1.13.1
  - @mastra/mcp@1.2.1
  - @mastra/memory@1.8.1

## 0.7.3

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`a1d6b9c`](https://github.com/mastra-ai/mastra/commit/a1d6b9c907c909f259632a7ea26e9e3c221fb691), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`c562ec2`](https://github.com/mastra-ai/mastra/commit/c562ec228f1af63693e2984ffa9712aa6db8fea8), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0
  - @mastra/mcp@1.2.1
  - @mastra/schema-compat@1.2.2
  - @mastra/memory@1.8.0

## 0.7.3-alpha.0

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`a1d6b9c`](https://github.com/mastra-ai/mastra/commit/a1d6b9c907c909f259632a7ea26e9e3c221fb691), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`c562ec2`](https://github.com/mastra-ai/mastra/commit/c562ec228f1af63693e2984ffa9712aa6db8fea8), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0
  - @mastra/mcp@1.2.1-alpha.0
  - @mastra/schema-compat@1.2.2-alpha.0
  - @mastra/memory@1.8.0-alpha.0

## 0.7.2

### Patch Changes

- dependencies updates: ([#14052](https://github.com/mastra-ai/mastra/pull/14052))
  - Updated dependency [`@composio/mastra@^0.6.4` ↗︎](https://www.npmjs.com/package/@composio/mastra/v/0.6.4) (from `^0.6.3`, in `dependencies`)
- Updated dependencies [[`709362d`](https://github.com/mastra-ai/mastra/commit/709362d67b80d8832729bbf9e449cad27640a5d2), [`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`b9a77b9`](https://github.com/mastra-ai/mastra/commit/b9a77b951fa6422077080b492cce74460d2f8fdd), [`787f3ac`](https://github.com/mastra-ai/mastra/commit/787f3ac08b3bb77413645a7ab5c447fa851708fd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`977b49e`](https://github.com/mastra-ai/mastra/commit/977b49e23d8b050a2c6a6a91c0aa38b28d6388ee), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/schema-compat@1.2.1
  - @mastra/core@1.12.0
  - @mastra/mcp@1.2.0
  - @mastra/memory@1.7.0

## 0.7.2-alpha.1

### Patch Changes

- Updated dependencies [[`709362d`](https://github.com/mastra-ai/mastra/commit/709362d67b80d8832729bbf9e449cad27640a5d2), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`977b49e`](https://github.com/mastra-ai/mastra/commit/977b49e23d8b050a2c6a6a91c0aa38b28d6388ee), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/schema-compat@1.2.1-alpha.1
  - @mastra/core@1.12.0-alpha.1
  - @mastra/memory@1.7.0-alpha.1
  - @mastra/mcp@1.2.0-alpha.0

## 0.7.2-alpha.0

### Patch Changes

- dependencies updates: ([#14052](https://github.com/mastra-ai/mastra/pull/14052))
  - Updated dependency [`@composio/mastra@^0.6.4` ↗︎](https://www.npmjs.com/package/@composio/mastra/v/0.6.4) (from `^0.6.3`, in `dependencies`)
- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`aede3cc`](https://github.com/mastra-ai/mastra/commit/aede3cc2a83b54bbd9e9a54c8aedcd1708b2ef87), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`b9a77b9`](https://github.com/mastra-ai/mastra/commit/b9a77b951fa6422077080b492cce74460d2f8fdd), [`787f3ac`](https://github.com/mastra-ai/mastra/commit/787f3ac08b3bb77413645a7ab5c447fa851708fd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c)]:
  - @mastra/core@1.12.0-alpha.0
  - @mastra/mcp@1.2.0-alpha.0
  - @mastra/schema-compat@1.2.1-alpha.0
  - @mastra/memory@1.6.3-alpha.0

## 0.7.1

### Patch Changes

- dependencies updates: ([#14046](https://github.com/mastra-ai/mastra/pull/14046))
  - Updated dependency [`@composio/core@^0.6.4` ↗︎](https://www.npmjs.com/package/@composio/core/v/0.6.4) (from `^0.6.3`, in `dependencies`)
- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`fb58ce1`](https://github.com/mastra-ai/mastra/commit/fb58ce1de85d57f142005c4b3b7559f909167a3f), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`57c7391`](https://github.com/mastra-ai/mastra/commit/57c739108b9a6c9160352f0468dfe0428c03a234), [`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed), [`18d91c3`](https://github.com/mastra-ai/mastra/commit/18d91c3b6e905cfd3ba50e7c7dc81164b6aa69ad), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`682b7f7`](https://github.com/mastra-ai/mastra/commit/682b7f773b7940687ef22569e720fd4bc4fdb8fe), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`3ebdadf`](https://github.com/mastra-ai/mastra/commit/3ebdadfe517d16f29464f35baba8356771160369), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0
  - @mastra/schema-compat@1.2.0
  - @mastra/memory@1.6.2
  - @mastra/mcp@1.1.0

## 0.7.1-alpha.0

### Patch Changes

- dependencies updates: ([#14046](https://github.com/mastra-ai/mastra/pull/14046))
  - Updated dependency [`@composio/core@^0.6.4` ↗︎](https://www.npmjs.com/package/@composio/core/v/0.6.4) (from `^0.6.3`, in `dependencies`)
- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`fb58ce1`](https://github.com/mastra-ai/mastra/commit/fb58ce1de85d57f142005c4b3b7559f909167a3f), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`57c7391`](https://github.com/mastra-ai/mastra/commit/57c739108b9a6c9160352f0468dfe0428c03a234), [`18d91c3`](https://github.com/mastra-ai/mastra/commit/18d91c3b6e905cfd3ba50e7c7dc81164b6aa69ad), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`682b7f7`](https://github.com/mastra-ai/mastra/commit/682b7f773b7940687ef22569e720fd4bc4fdb8fe), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`3ebdadf`](https://github.com/mastra-ai/mastra/commit/3ebdadfe517d16f29464f35baba8356771160369), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0-alpha.0
  - @mastra/schema-compat@1.2.0-alpha.0
  - @mastra/memory@1.6.2-alpha.0
  - @mastra/mcp@1.1.0

## 0.7.0

### Minor Changes

- Added `FilesystemStore`, a file-based storage adapter for editor domains. Stores agent configurations, prompt blocks, scorer definitions, MCP clients, MCP servers, workspaces, and skills as JSON files in a local directory (default: `.mastra-storage/`). Only published snapshots are written to disk — version history is kept in memory. Use with `MastraCompositeStore`'s `editor` shorthand to enable Git-friendly editor configurations. ([#13727](https://github.com/mastra-ai/mastra/pull/13727))

  ```typescript
  import { FilesystemStore, MastraCompositeStore } from '@mastra/core/storage';
  import { PostgresStore } from '@mastra/pg';

  export const mastra = new Mastra({
    storage: new MastraCompositeStore({
      id: 'composite',
      default: new PostgresStore({ id: 'pg', connectionString: process.env.DATABASE_URL }),
      editor: new FilesystemStore({ dir: '.mastra-storage' }),
    }),
  });
  ```

  Added `applyStoredOverrides` to the editor agent namespace. When a stored configuration exists for a code-defined agent, the editor merges the stored **instructions** and **tools** on top of the code agent's values at runtime. Model, memory, workspace, and other code-defined fields are never overridden — they may contain SDK instances or dynamic functions that cannot be safely serialized. Original code-defined values are preserved via a WeakMap and restored if the stored override is deleted.

### Patch Changes

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`08072ec`](https://github.com/mastra-ai/mastra/commit/08072ec54b5dfe810ed66c0d583ae9d1a9103c11), [`ef9d0f0`](https://github.com/mastra-ai/mastra/commit/ef9d0f0fa98ff225b17afe071f5b84a9258dc142), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`9e21667`](https://github.com/mastra-ai/mastra/commit/9e2166746df81da8f1f933a918741fc52f922c70), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`3ceb231`](https://github.com/mastra-ai/mastra/commit/3ceb2317aad7da36df5053e7c84f9381eeb68d11), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`ef888d2`](https://github.com/mastra-ai/mastra/commit/ef888d23c77f85f4c202228b63f8fd9b6d9361af), [`e7a567c`](https://github.com/mastra-ai/mastra/commit/e7a567cfb3e65c955a07d0167cb1b4141f5bda01), [`3626623`](https://github.com/mastra-ai/mastra/commit/36266238eb7db78fce2ac34187194613f6f53733), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0
  - @mastra/memory@1.6.1
  - @mastra/mcp@1.1.0

## 0.7.0-alpha.0

### Minor Changes

- Added `FilesystemStore`, a file-based storage adapter for editor domains. Stores agent configurations, prompt blocks, scorer definitions, MCP clients, MCP servers, workspaces, and skills as JSON files in a local directory (default: `.mastra-storage/`). Only published snapshots are written to disk — version history is kept in memory. Use with `MastraCompositeStore`'s `editor` shorthand to enable Git-friendly editor configurations. ([#13727](https://github.com/mastra-ai/mastra/pull/13727))

  ```typescript
  import { FilesystemStore, MastraCompositeStore } from '@mastra/core/storage';
  import { PostgresStore } from '@mastra/pg';

  export const mastra = new Mastra({
    storage: new MastraCompositeStore({
      id: 'composite',
      default: new PostgresStore({ id: 'pg', connectionString: process.env.DATABASE_URL }),
      editor: new FilesystemStore({ dir: '.mastra-storage' }),
    }),
  });
  ```

  Added `applyStoredOverrides` to the editor agent namespace. When a stored configuration exists for a code-defined agent, the editor merges the stored **instructions** and **tools** on top of the code agent's values at runtime. Model, memory, workspace, and other code-defined fields are never overridden — they may contain SDK instances or dynamic functions that cannot be safely serialized. Original code-defined values are preserved via a WeakMap and restored if the stored override is deleted.

### Patch Changes

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`08072ec`](https://github.com/mastra-ai/mastra/commit/08072ec54b5dfe810ed66c0d583ae9d1a9103c11), [`ef9d0f0`](https://github.com/mastra-ai/mastra/commit/ef9d0f0fa98ff225b17afe071f5b84a9258dc142), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`9e21667`](https://github.com/mastra-ai/mastra/commit/9e2166746df81da8f1f933a918741fc52f922c70), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`3ceb231`](https://github.com/mastra-ai/mastra/commit/3ceb2317aad7da36df5053e7c84f9381eeb68d11), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`1391f22`](https://github.com/mastra-ai/mastra/commit/1391f227ff197080de185ac1073c1d1568c0631f), [`ef888d2`](https://github.com/mastra-ai/mastra/commit/ef888d23c77f85f4c202228b63f8fd9b6d9361af), [`e7a567c`](https://github.com/mastra-ai/mastra/commit/e7a567cfb3e65c955a07d0167cb1b4141f5bda01), [`3626623`](https://github.com/mastra-ai/mastra/commit/36266238eb7db78fce2ac34187194613f6f53733), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0-alpha.0
  - @mastra/memory@1.6.1-alpha.0
  - @mastra/mcp@1.1.0-alpha.0

## 0.6.3

### Patch Changes

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`24f7204`](https://github.com/mastra-ai/mastra/commit/24f72046eb35b47c75d36193af4fb817b588720d), [`359d687`](https://github.com/mastra-ai/mastra/commit/359d687527ab95a79e0ec0487dcecec8d9c7c7dc), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9e77e8f`](https://github.com/mastra-ai/mastra/commit/9e77e8f0e823ef58cb448dd1f390fce987a101f3), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`56f2018`](https://github.com/mastra-ai/mastra/commit/56f2018cb38969c11933e815a5f70cf631d3964a), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`fde104d`](https://github.com/mastra-ai/mastra/commit/fde104da80935d6e0dd24327e86a51011fcb3173), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`23b43dd`](https://github.com/mastra-ai/mastra/commit/23b43ddd0e3db05dee828c2733faa2496b7b0319), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0
  - @mastra/memory@1.6.0
  - @mastra/mcp@1.0.3

## 0.6.3-alpha.0

### Patch Changes

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`24f7204`](https://github.com/mastra-ai/mastra/commit/24f72046eb35b47c75d36193af4fb817b588720d), [`359d687`](https://github.com/mastra-ai/mastra/commit/359d687527ab95a79e0ec0487dcecec8d9c7c7dc), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9e77e8f`](https://github.com/mastra-ai/mastra/commit/9e77e8f0e823ef58cb448dd1f390fce987a101f3), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`56f2018`](https://github.com/mastra-ai/mastra/commit/56f2018cb38969c11933e815a5f70cf631d3964a), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`fde104d`](https://github.com/mastra-ai/mastra/commit/fde104da80935d6e0dd24327e86a51011fcb3173), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`23b43dd`](https://github.com/mastra-ai/mastra/commit/23b43ddd0e3db05dee828c2733faa2496b7b0319), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0
  - @mastra/memory@1.6.0-alpha.0
  - @mastra/mcp@1.0.3-alpha.0

## 0.6.2

### Patch Changes

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`8d14a59`](https://github.com/mastra-ai/mastra/commit/8d14a591d46fbbbe81baa33c9c267d596f790329), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0
  - @mastra/mcp@1.0.2
  - @mastra/schema-compat@1.1.3
  - @mastra/memory@1.5.2

## 0.6.2-alpha.0

### Patch Changes

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`8d14a59`](https://github.com/mastra-ai/mastra/commit/8d14a591d46fbbbe81baa33c9c267d596f790329), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0
  - @mastra/mcp@1.0.2-alpha.0
  - @mastra/schema-compat@1.1.3-alpha.0
  - @mastra/memory@1.5.2-alpha.0

## 0.6.1

### Patch Changes

- Updated dependencies [[`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/memory@1.5.1
  - @mastra/core@1.7.0

## 0.6.1-alpha.0

### Patch Changes

- Updated dependencies [[`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/memory@1.5.1-alpha.0
  - @mastra/core@1.7.0-alpha.0

## 0.6.0

### Minor Changes

- Added Processor Providers — a new system for configuring and hydrating processors on stored agents. Define custom processor types with config schemas, available phases, and a factory method, then compose them into serializable processor graphs that support sequential, parallel, and conditional execution. ([#13219](https://github.com/mastra-ai/mastra/pull/13219))

  **Example — custom processor provider:**

  ```ts
  import { MastraEditor } from '@mastra/editor';

  // Built-in processors (token-limiter, unicode-normalizer, etc.) are registered automatically.
  // Only register custom providers for your own processors:
  const editor = new MastraEditor({
    processorProviders: {
      'my-custom-filter': myCustomFilterProvider,
    },
  });
  ```

  **Example — stored agent with a processor graph:**

  ```ts
  const agentConfig = {
    inputProcessors: {
      steps: [
        {
          type: 'step',
          step: { id: 'norm', providerId: 'unicode-normalizer', config: {}, enabledPhases: ['processInput'] },
        },
        {
          type: 'step',
          step: {
            id: 'limit',
            providerId: 'token-limiter',
            config: { limit: 4000 },
            enabledPhases: ['processInput', 'processOutputStream'],
          },
        },
      ],
    },
  };
  ```

- Added MCP server storage and editor support. MCP server configurations can now be persisted in storage and managed through the editor CMS. The editor's `mcpServer` namespace provides full CRUD operations and automatically hydrates stored configs into running `MCPServer` instances by resolving tool, agent, and workflow references from the Mastra registry. ([#13285](https://github.com/mastra-ai/mastra/pull/13285))

  ```ts
  const editor = new MastraEditor();
  const mastra = new Mastra({
    tools: { getWeather: weatherTool, calculate: calculatorTool },
    storage: new LibSQLStore({ url: ':memory:' }),
    editor,
  });

  // Store an MCP server config referencing tools by ID
  const server = await editor.mcpServer.create({
    id: 'my-server',
    name: 'My MCP Server',
    version: '1.0.0',
    tools: { getWeather: {}, calculate: { description: 'Custom description' } },
  });

  // Retrieve — automatically hydrates into a real MCPServer with resolved tools
  const mcp = await editor.mcpServer.getById('my-server');
  const tools = mcp.tools(); // { getWeather: ..., calculate: ... }
  ```

### Patch Changes

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`7184d87`](https://github.com/mastra-ai/mastra/commit/7184d87c9237d26862f500ccfd0c9f9eadd38ddf), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0
  - @mastra/schema-compat@1.1.2
  - @mastra/memory@1.5.0

## 0.6.0-alpha.0

### Minor Changes

- Added Processor Providers — a new system for configuring and hydrating processors on stored agents. Define custom processor types with config schemas, available phases, and a factory method, then compose them into serializable processor graphs that support sequential, parallel, and conditional execution. ([#13219](https://github.com/mastra-ai/mastra/pull/13219))

  **Example — custom processor provider:**

  ```ts
  import { MastraEditor } from '@mastra/editor';

  // Built-in processors (token-limiter, unicode-normalizer, etc.) are registered automatically.
  // Only register custom providers for your own processors:
  const editor = new MastraEditor({
    processorProviders: {
      'my-custom-filter': myCustomFilterProvider,
    },
  });
  ```

  **Example — stored agent with a processor graph:**

  ```ts
  const agentConfig = {
    inputProcessors: {
      steps: [
        {
          type: 'step',
          step: { id: 'norm', providerId: 'unicode-normalizer', config: {}, enabledPhases: ['processInput'] },
        },
        {
          type: 'step',
          step: {
            id: 'limit',
            providerId: 'token-limiter',
            config: { limit: 4000 },
            enabledPhases: ['processInput', 'processOutputStream'],
          },
        },
      ],
    },
  };
  ```

- Added MCP server storage and editor support. MCP server configurations can now be persisted in storage and managed through the editor CMS. The editor's `mcpServer` namespace provides full CRUD operations and automatically hydrates stored configs into running `MCPServer` instances by resolving tool, agent, and workflow references from the Mastra registry. ([#13285](https://github.com/mastra-ai/mastra/pull/13285))

  ```ts
  const editor = new MastraEditor();
  const mastra = new Mastra({
    tools: { getWeather: weatherTool, calculate: calculatorTool },
    storage: new LibSQLStore({ url: ':memory:' }),
    editor,
  });

  // Store an MCP server config referencing tools by ID
  const server = await editor.mcpServer.create({
    id: 'my-server',
    name: 'My MCP Server',
    version: '1.0.0',
    tools: { getWeather: {}, calculate: { description: 'Custom description' } },
  });

  // Retrieve — automatically hydrates into a real MCPServer with resolved tools
  const mcp = await editor.mcpServer.getById('my-server');
  const tools = mcp.tools(); // { getWeather: ..., calculate: ... }
  ```

### Patch Changes

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`7184d87`](https://github.com/mastra-ai/mastra/commit/7184d87c9237d26862f500ccfd0c9f9eadd38ddf), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0-alpha.0
  - @mastra/schema-compat@1.1.2-alpha.0
  - @mastra/memory@1.5.0-alpha.0

## 0.5.0

### Minor Changes

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

### Patch Changes

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`1415bcd`](https://github.com/mastra-ai/mastra/commit/1415bcd894baba03e07640b3b1986037db49559d), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0
  - @mastra/memory@1.4.0
  - @mastra/schema-compat@1.1.1

## 0.5.0-alpha.1

### Patch Changes

- Updated dependencies [[`1415bcd`](https://github.com/mastra-ai/mastra/commit/1415bcd894baba03e07640b3b1986037db49559d)]:
  - @mastra/schema-compat@1.1.1-alpha.0
  - @mastra/core@1.5.0-alpha.1
  - @mastra/memory@1.4.0-alpha.1

## 0.5.0-alpha.0

### Minor Changes

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

### Patch Changes

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/memory@1.4.0-alpha.0

## 0.4.0

### Minor Changes

- Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage. ([#12962](https://github.com/mastra-ai/mastra/pull/12962))

  **Example usage in the playground:**

  Enable the Observational Memory toggle in the Memory section, then configure:
  - Top-level model (provider + model) used by both observer and reflector
  - Scope: `thread` (per-conversation) or `resource` (shared across threads)
  - Expand **Observer** or **Reflector** sections to override models and tune token budgets

  **Programmatic usage via client SDK:**

  ```ts
  await client.createStoredAgent({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await client.createStoredAgent({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

  **Programmatic usage via editor:**

  ```ts
  await editor.agent.create({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await editor.agent.create({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

- Added MCP client management, integration tools resolution, and built-in Composio and Arcade AI tool providers. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **MCP Client Namespace**

  New `editor.mcpClient` namespace for managing stored MCP client configurations with full CRUD operations. Stored agents can reference MCP clients with per-server tool filtering.

  **Integration Tools**

  Stored agents now support an `integrationTools` conditional field that resolves tools from registered `ToolProvider` instances at hydration time:

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { ComposioToolProvider } from '@mastra/editor/composio';
  import { ArcadeToolProvider } from '@mastra/editor/arcade';

  const editor = new MastraEditor({
    // ...
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '...' }),
      arcade: new ArcadeToolProvider({ apiKey: '...' }),
    },
  });
  ```

  **Built-in Tool Providers**
  - `@mastra/editor/composio` — Composio tool provider with toolkit/tool discovery and execution via `@composio/core` and `@composio/mastra` SDKs
  - `@mastra/editor/arcade` — Arcade AI tool provider with a pre-seeded catalog of 93 toolkits, tool discovery, and execution via `@arcadeai/arcadejs` SDK

  Each provider is a separate entry point — importing `@mastra/editor` alone does not load any provider SDK code.

### Patch Changes

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`191bc3a`](https://github.com/mastra-ai/mastra/commit/191bc3adfdbe4b262dbc93b7d9c3d6c6a3c8ef92), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`74fb394`](https://github.com/mastra-ai/mastra/commit/74fb3944f51f55e1fc1ca65eede4254d8fe72aa3), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`cb8c38e`](https://github.com/mastra-ai/mastra/commit/cb8c38e6f855ad190383a7112ba95abef072d490), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0
  - @mastra/memory@1.3.0

## 0.4.0-alpha.0

### Minor Changes

- Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage. ([#12962](https://github.com/mastra-ai/mastra/pull/12962))

  **Example usage in the playground:**

  Enable the Observational Memory toggle in the Memory section, then configure:
  - Top-level model (provider + model) used by both observer and reflector
  - Scope: `thread` (per-conversation) or `resource` (shared across threads)
  - Expand **Observer** or **Reflector** sections to override models and tune token budgets

  **Programmatic usage via client SDK:**

  ```ts
  await client.createStoredAgent({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await client.createStoredAgent({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

  **Programmatic usage via editor:**

  ```ts
  await editor.agent.create({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await editor.agent.create({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

- Added MCP client management, integration tools resolution, and built-in Composio and Arcade AI tool providers. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **MCP Client Namespace**

  New `editor.mcpClient` namespace for managing stored MCP client configurations with full CRUD operations. Stored agents can reference MCP clients with per-server tool filtering.

  **Integration Tools**

  Stored agents now support an `integrationTools` conditional field that resolves tools from registered `ToolProvider` instances at hydration time:

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { ComposioToolProvider } from '@mastra/editor/composio';
  import { ArcadeToolProvider } from '@mastra/editor/arcade';

  const editor = new MastraEditor({
    // ...
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '...' }),
      arcade: new ArcadeToolProvider({ apiKey: '...' }),
    },
  });
  ```

  **Built-in Tool Providers**
  - `@mastra/editor/composio` — Composio tool provider with toolkit/tool discovery and execution via `@composio/core` and `@composio/mastra` SDKs
  - `@mastra/editor/arcade` — Arcade AI tool provider with a pre-seeded catalog of 93 toolkits, tool discovery, and execution via `@arcadeai/arcadejs` SDK

  Each provider is a separate entry point — importing `@mastra/editor` alone does not load any provider SDK code.

### Patch Changes

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`191bc3a`](https://github.com/mastra-ai/mastra/commit/191bc3adfdbe4b262dbc93b7d9c3d6c6a3c8ef92), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`74fb394`](https://github.com/mastra-ai/mastra/commit/74fb3944f51f55e1fc1ca65eede4254d8fe72aa3), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`cb8c38e`](https://github.com/mastra-ai/mastra/commit/cb8c38e6f855ad190383a7112ba95abef072d490), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0
  - @mastra/memory@1.3.0-alpha.0

## 0.3.0

### Minor Changes

- Added `requestContextSchema` and rule-based conditional fields for stored agents. ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

  Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

  **New `requestContextSchema` field**

  Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

  **Conditional field example**

  ```ts
  await agentsStore.create({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are a helpful assistant',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: [
        { value: { 'basic-tool': {} } },
        {
          value: { 'premium-tool': {} },
          rules: {
            operator: 'AND',
            conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
          },
        },
      ],
      requestContextSchema: {
        type: 'object',
        properties: { tier: { type: 'string' } },
      },
    },
  });
  ```

- Added dynamic instructions for stored agents. Agent instructions can now be composed from reusable prompt blocks with conditional rules and variable interpolation, enabling a prompt-CMS-like editing experience. ([#12861](https://github.com/mastra-ai/mastra/pull/12861))

  **Instruction blocks** can be mixed in an agent's instructions array:
  - `text` — static text with `{{variable}}` interpolation
  - `prompt_block_ref` — reference to a versioned prompt block stored in the database
  - `prompt_block` — inline prompt block with optional conditional rules

  **Creating a prompt block and using it in a stored agent:**

  ```ts
  // Create a reusable prompt block
  const block = await editor.createPromptBlock({
    id: 'security-rules',
    name: 'Security Rules',
    content: "You must verify the user's identity. The user's role is {{user.role}}.",
    rules: {
      operator: 'AND',
      conditions: [{ field: 'user.isAuthenticated', operator: 'equals', value: true }],
    },
  });

  // Create a stored agent that references the prompt block
  await editor.createStoredAgent({
    id: 'support-agent',
    name: 'Support Agent',
    instructions: [
      { type: 'text', content: 'You are a helpful support agent for {{company}}.' },
      { type: 'prompt_block_ref', id: 'security-rules' },
      {
        type: 'prompt_block',
        content: 'Always be polite.',
        rules: { operator: 'AND', conditions: [{ field: 'tone', operator: 'equals', value: 'formal' }] },
      },
    ],
    model: { provider: 'openai', name: 'gpt-4o' },
  });

  // At runtime, instructions resolve dynamically based on request context
  const agent = await editor.getStoredAgentById('support-agent');
  const result = await agent.generate('Help me reset my password', {
    requestContext: new RequestContext([
      ['company', 'Acme Corp'],
      ['user.isAuthenticated', true],
      ['user.role', 'admin'],
      ['tone', 'formal'],
    ]),
  });
  ```

  Prompt blocks are versioned — updating a block's content takes effect immediately for all agents referencing it, with no cache clearing required.

- **Added stored scorer definitions, editor namespace pattern, and generic storage domains** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added a new `scorer-definitions` storage domain for storing LLM-as-judge and preset scorer configurations in the database
  - Introduced a `VersionedStorageDomain` generic base class that unifies `AgentsStorage`, `PromptBlocksStorage`, and `ScorerDefinitionsStorage` with shared CRUD methods (`create`, `getById`, `getByIdResolved`, `update`, `delete`, `list`, `listResolved`)
  - Flattened stored scorer type system: replaced nested `preset`/`customLLMJudge` config with top-level `type`, `instructions`, `scoreRange`, and `presetConfig` fields
  - Refactored `MastraEditor` to use a namespace pattern (`editor.agent.*`, `editor.scorer.*`, `editor.prompt.*`) backed by a `CrudEditorNamespace` base class with built-in caching and an `onCacheEvict` hook
  - Added `rawConfig` support to `MastraBase` and `MastraScorer` via `toRawConfig()`, so hydrated primitives carry their stored configuration
  - Added prompt block and scorer registration to the `Mastra` class (`addPromptBlock`, `removePromptBlock`, `addScorer`, `removeScorer`)

  **Creating a stored scorer (LLM-as-judge):**

  ```ts
  const scorer = await editor.scorer.create({
    id: 'my-scorer',
    name: 'Response Quality',
    type: 'llm-judge',
    instructions: 'Evaluate the response for accuracy and helpfulness.',
    model: { provider: 'openai', name: 'gpt-4o' },
    scoreRange: { min: 0, max: 1 },
  });
  ```

  **Retrieving and resolving a stored scorer:**

  ```ts
  // Fetch the stored definition from DB
  const definition = await editor.scorer.getById('my-scorer');

  // Resolve it into a runnable MastraScorer instance
  const runnableScorer = editor.scorer.resolve(definition);

  // Execute the scorer
  const result = await runnableScorer.run({
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
  });
  ```

  **Editor namespace pattern (before/after):**

  ```ts
  // Before
  const agent = await editor.getStoredAgentById('abc');
  const prompts = await editor.listPromptBlocks();

  // After
  const agent = await editor.agent.getById('abc');
  const prompts = await editor.prompt.list();
  ```

  **Generic storage domain methods (before/after):**

  ```ts
  // Before
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });

  // After
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

- **Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`. ([#12904](https://github.com/mastra-ai/mastra/pull/12904))

  If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

  ```ts
  // Before
  const result = await agent.cloneAgent({ newId: 'my-clone' });

  // After
  const editor = mastra.getEditor();
  const result = await editor.agent.clone(agent, { newId: 'my-clone' });
  ```

  **Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

  **Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.

### Patch Changes

- Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted ([#12693](https://github.com/mastra-ai/mastra/pull/12693))

- Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail. ([#12903](https://github.com/mastra-ai/mastra/pull/12903))

- Fix memory persistence: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed memory persistence bug by handling missing vector store gracefully
  - When semantic recall is enabled but no vector store is configured, it now disables semantic recall instead of failing
  - Fixed type compatibility for `embedder` field when creating agents from stored config

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0
  - @mastra/memory@1.2.0

## 0.3.0-alpha.3

### Patch Changes

- Updated dependencies [[`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211)]:
  - @mastra/memory@1.2.0-alpha.2

## 0.3.0-alpha.2

### Patch Changes

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/memory@1.2.0-alpha.1
  - @mastra/core@1.3.0-alpha.2

## 0.3.0-alpha.1

### Minor Changes

- Added `requestContextSchema` and rule-based conditional fields for stored agents. ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

  Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

  **New `requestContextSchema` field**

  Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

  **Conditional field example**

  ```ts
  await agentsStore.create({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are a helpful assistant',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: [
        { value: { 'basic-tool': {} } },
        {
          value: { 'premium-tool': {} },
          rules: {
            operator: 'AND',
            conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
          },
        },
      ],
      requestContextSchema: {
        type: 'object',
        properties: { tier: { type: 'string' } },
      },
    },
  });
  ```

- Added dynamic instructions for stored agents. Agent instructions can now be composed from reusable prompt blocks with conditional rules and variable interpolation, enabling a prompt-CMS-like editing experience. ([#12861](https://github.com/mastra-ai/mastra/pull/12861))

  **Instruction blocks** can be mixed in an agent's instructions array:
  - `text` — static text with `{{variable}}` interpolation
  - `prompt_block_ref` — reference to a versioned prompt block stored in the database
  - `prompt_block` — inline prompt block with optional conditional rules

  **Creating a prompt block and using it in a stored agent:**

  ```ts
  // Create a reusable prompt block
  const block = await editor.createPromptBlock({
    id: 'security-rules',
    name: 'Security Rules',
    content: "You must verify the user's identity. The user's role is {{user.role}}.",
    rules: {
      operator: 'AND',
      conditions: [{ field: 'user.isAuthenticated', operator: 'equals', value: true }],
    },
  });

  // Create a stored agent that references the prompt block
  await editor.createStoredAgent({
    id: 'support-agent',
    name: 'Support Agent',
    instructions: [
      { type: 'text', content: 'You are a helpful support agent for {{company}}.' },
      { type: 'prompt_block_ref', id: 'security-rules' },
      {
        type: 'prompt_block',
        content: 'Always be polite.',
        rules: { operator: 'AND', conditions: [{ field: 'tone', operator: 'equals', value: 'formal' }] },
      },
    ],
    model: { provider: 'openai', name: 'gpt-4o' },
  });

  // At runtime, instructions resolve dynamically based on request context
  const agent = await editor.getStoredAgentById('support-agent');
  const result = await agent.generate('Help me reset my password', {
    requestContext: new RequestContext([
      ['company', 'Acme Corp'],
      ['user.isAuthenticated', true],
      ['user.role', 'admin'],
      ['tone', 'formal'],
    ]),
  });
  ```

  Prompt blocks are versioned — updating a block's content takes effect immediately for all agents referencing it, with no cache clearing required.

- **Added stored scorer definitions, editor namespace pattern, and generic storage domains** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added a new `scorer-definitions` storage domain for storing LLM-as-judge and preset scorer configurations in the database
  - Introduced a `VersionedStorageDomain` generic base class that unifies `AgentsStorage`, `PromptBlocksStorage`, and `ScorerDefinitionsStorage` with shared CRUD methods (`create`, `getById`, `getByIdResolved`, `update`, `delete`, `list`, `listResolved`)
  - Flattened stored scorer type system: replaced nested `preset`/`customLLMJudge` config with top-level `type`, `instructions`, `scoreRange`, and `presetConfig` fields
  - Refactored `MastraEditor` to use a namespace pattern (`editor.agent.*`, `editor.scorer.*`, `editor.prompt.*`) backed by a `CrudEditorNamespace` base class with built-in caching and an `onCacheEvict` hook
  - Added `rawConfig` support to `MastraBase` and `MastraScorer` via `toRawConfig()`, so hydrated primitives carry their stored configuration
  - Added prompt block and scorer registration to the `Mastra` class (`addPromptBlock`, `removePromptBlock`, `addScorer`, `removeScorer`)

  **Creating a stored scorer (LLM-as-judge):**

  ```ts
  const scorer = await editor.scorer.create({
    id: 'my-scorer',
    name: 'Response Quality',
    type: 'llm-judge',
    instructions: 'Evaluate the response for accuracy and helpfulness.',
    model: { provider: 'openai', name: 'gpt-4o' },
    scoreRange: { min: 0, max: 1 },
  });
  ```

  **Retrieving and resolving a stored scorer:**

  ```ts
  // Fetch the stored definition from DB
  const definition = await editor.scorer.getById('my-scorer');

  // Resolve it into a runnable MastraScorer instance
  const runnableScorer = editor.scorer.resolve(definition);

  // Execute the scorer
  const result = await runnableScorer.run({
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
  });
  ```

  **Editor namespace pattern (before/after):**

  ```ts
  // Before
  const agent = await editor.getStoredAgentById('abc');
  const prompts = await editor.listPromptBlocks();

  // After
  const agent = await editor.agent.getById('abc');
  const prompts = await editor.prompt.list();
  ```

  **Generic storage domain methods (before/after):**

  ```ts
  // Before
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });

  // After
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

- **Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`. ([#12904](https://github.com/mastra-ai/mastra/pull/12904))

  If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

  ```ts
  // Before
  const result = await agent.cloneAgent({ newId: 'my-clone' });

  // After
  const editor = mastra.getEditor();
  const result = await editor.agent.clone(agent, { newId: 'my-clone' });
  ```

  **Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

  **Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.

### Patch Changes

- Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail. ([#12903](https://github.com/mastra-ai/mastra/pull/12903))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1
  - @mastra/memory@1.2.0-alpha.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted ([#12693](https://github.com/mastra-ai/mastra/pull/12693))

- Fix memory persistence: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed memory persistence bug by handling missing vector store gracefully
  - When semantic recall is enabled but no vector store is configured, it now disables semantic recall instead of failing
  - Fixed type compatibility for `embedder` field when creating agents from stored config

- Updated dependencies [[`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/core@1.2.1-alpha.0

## 0.2.0

### Minor Changes

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

### Patch Changes

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0
  - @mastra/memory@1.1.0

## 0.2.0-alpha.0

### Minor Changes

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

### Patch Changes

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3)]:
  - @mastra/memory@1.1.0-alpha.1
  - @mastra/core@1.2.0-alpha.1

## 0.1.0

### Minor Changes

- Initial release of @mastra/editor
  - Agent storage and retrieval from database
  - Dynamic agent creation from stored configurations
  - Support for tools, workflows, nested agents, memory, and scorers
  - Integration with Mastra core for seamless agent management
