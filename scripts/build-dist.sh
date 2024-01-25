#!/bin/bash
set -Exu
set -o pipefail
# Builds the release tarball for Yarn.

umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)

# Workaround for https://github.com/yarnpkg/yarn/issues/2591
case "$(uname -s)" in
  *CYGWIN*|MSYS*|MINGW*)
    system_yarn=yarn.cmd
    ;;
  *)
    system_yarn=yarn
    ;;
esac

version=`node -p "require('./package.json').version"`
node_version=`node -p "process.versions.node.split('.')[0]"`

rm -rf artifacts dist
mkdir artifacts
mkdir dist{,/bin,/lib}

# Workaround for https://github.com/yarnpkg/yarn/issues/2591
eval $system_yarn run build
eval $system_yarn run build:bundle
chmod +x artifacts/*.js
# Verify that it works as expected
if (( node_version > 12 )); then
  [[ "$version" == "$(node artifacts/yarn2-$version.js --version)" ]] || exit 1
fi
[[ "$version" == "$(node artifacts/yarn2-legacy-$version.js --version)" ]] || exit 1

cp package.json dist/
cp README.md dist/
cp LICENSE dist/

cp artifacts/yarn2-$version.js dist/lib/cli.js
cp bin/{yarn2.js,yarn2,yarn2pkg,*.cmd} dist/bin/
chmod +x dist/bin/*

# We cannot bundle v8-compile-cache as it must be loaded separately to be effective.
cp node_modules/v8-compile-cache/v8-compile-cache.js dist/lib/v8-compile-cache.js

# Verify that it works as expected
[[ "$version" == "$(./dist/bin/yarn2 --version)" ]] || exit 1;

./scripts/update-dist-manifest.js $(node -p "require('fs').realpathSync('dist/package.json')") tar

case "$(tar --version)" in
  *GNU*)
    tar -cvzf artifacts/yarn2-v$version.tar.gz --transform="s/^dist/yarn2-v$version/" dist/*
    ;;
  bsdtar*)
    tar -cvzf artifacts/yarn2-v$version.tar.gz -s "/^dist/yarn2-v$version/" dist/*
    ;;
  *)
    echo "Can't determine tar type (BSD/GNU)!"
    exit 1
    ;;
esac
