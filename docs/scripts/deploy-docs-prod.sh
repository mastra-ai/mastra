#!/bin/bash
echo "env: $VERCEL_ENV"

# Check if the commit message contains "chore: version - enter prerelease mode"
# and only build the docs if it does
# reference: https://vercel.com/guides/how-do-i-use-the-ignored-build-step-field-on-vercel#with-a-script
commit_message=$(git log -1 --pretty=%B)

if [[ "$VERCEL_ENV" == "production" ]]; then
  if [[ ${commit_message,,} = "chore: version - enter prerelease mode" ]]; then
    echo "✅ - Build can proceed"
    exit 0;
  else
    echo "🛑 - Build cancelled"
    exit 1;
  fi
fi

echo "✅ - Build can proceed"
exit 0;