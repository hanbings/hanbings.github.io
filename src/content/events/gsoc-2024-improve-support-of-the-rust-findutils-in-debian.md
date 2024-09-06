---
title: 'GSoC 2024:  Improve support of the Rust  findutils in Debian'
description: 'GSoC 2024:  Improve support of the Rust  findutils in Debian'
date: '2024-08-25 04:29:01'
author: 'hanbings (hanbings@hanbings.io)'
---

Hi, I am [hanbings](https://github.com/hanbings). and provided most of the code submissions during [GSoC](https://summerofcode.withgoogle.com/programs/2024/projects/Rv3xx9w2) in the table below.

## Description

[uutils/findutils](https://github.com/uutils/findutils): A safer and more performant implementation of the GNU suite's xargs, find, locate and updatedb tools in rust.

Currently, findutils implements many common commands in Linux and provides a better user experience in addition to compatibility. However, the current pass number in the GNU test is still relatively low, and there are many features that have not yet been implemented. By implementing them and writing test code, compatibility with the original GNU suite will be improved, and using the Rust language will result in high maintainability and high performance.

The main work in this GSoC proposal is as follows:

- Investigate pre-2020 issues to determine if they have been fixed, implemented, or otherwise. (1 weeks)
- Identify directions for improving compatibility based on GNU testing of findutils. (9 weeks)
- Improve test code coverage of other codes in findutils. (2 weeks)

## Achievements

> In addition, I have a work document showing the progress of the past two months. [Click here](https://docs.google.com/document/d/1TqQpV4U7Z-GJYnZpJPGYvMjDxCnAE8mvoWfzhbooAQA/edit)

**Implementing the `find` feature.**

| Implement                                   | Issues Link                                                  | PR Link                                                      | Merged |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------ |
| -anewer -cnewer                             | ✅[ https://github.com/uutils/findutils/issues/370](https://github.com/uutils/findutils/issues/370) | ✅https://github.com/uutils/findutils/pull/386                | ✅      |
| -context                                    | ✅https://github.com/uutils/findutils/issues/375              |                                                              |        |
| -daystart                                   | ✅https://github.com/uutils/findutils/issues/372              | ✅https://github.com/uutils/findutils/pull/413                | ✅      |
| -files0-from                                | ✅https://github.com/uutils/findutils/issues/378              |                                                              |        |
| -fls -ls -fprintf                           | ✅https://github.com/uutils/findutils/issues/382 and [https://github.com/uutils/findutils/issues/383](https://github.com/uutils/findutils/issues/383) | ✅https://github.com/uutils/findutils/pull/435                | ✅      |
| -fprint                                     | ✅[ https://github.com/uutils/findutils/issues/381](https://github.com/uutils/findutils/issues/381) | ✅https://github.com/uutils/findutils/pull/421                |        |
| -fprint0                                    | ✅https://github.com/uutils/findutils/issues/380              | ✅https://github.com/uutils/findutils/pull/443                |        |
| -fstype                                     | ✅https://github.com/uutils/findutils/issues/374              | ✅https://github.com/uutils/findutils/pull/408                | ✅      |
| -gid -uid                                   | ✅https://github.com/uutils/findutils/issues/371              | ✅https://github.com/uutils/findutils/pull/405                | ✅      |
| -ignore_readdir_race -noignore_readdir_race | ✅https://github.com/uutils/findutils/issues/377              | 🚧https://github.com/uutils/findutils/pull/411                |        |
| -samefile                                   | ✅https://github.com/uutils/findutils/issues/373              | ✅h[ttps://github.com/uutils/findutils/pull/389](http://github.com/uutils/findutils/pull/389) | ✅      |
| -xtype                                      | ✅https://github.com/uutils/findutils/issues/379              | ✅https://github.com/uutils/findutils/pull/436                | ✅      |
| -follow                                     | ✅https://github.com/uutils/findutils/issues/308              | ✅https://github.com/uutils/findutils/pull/420                | ✅      |
| -H -L -P                                    | ✅https://github.com/uutils/findutils/issues/412              | ✅https://github.com/uutils/findutils/pull/436                | ✅      |
| -noleaf                                     | ✅https://github.com/uutils/findutils/issues/376              | ✅https://github.com/uutils/findutils/pull/414                | ✅      |

**Other**

[find: Fix -newerXY test code for Windows platform](https://github.com/uutils/findutils/pull/394)

[find: Fix convert_arg_to_comparable_value() function parsing unexpected characters.](https://github.com/uutils/findutils/pull/361)

[Provide GNU test comparison comments for PRs in Github Actions.](https://github.com/uutils/findutils/pull/400)

## TODO

To be honest, the goal of this GSoC is not completely complete. We still have a lot of integration testing (mainly reflected in test coverage) work to be completed. In the near future, I will continue to complete this work.



I would like to express my heartfelt gratitude to my mentors for their invaluable guidance and support. : )

