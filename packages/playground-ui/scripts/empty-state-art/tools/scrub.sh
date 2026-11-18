#!/bin/bash
B=${BROWSER:-agent-browser}; N=$1; ST=$2; PF=$3; shift 3
$B eval "(()=>{document.querySelector('button[data-state=$ST]').click();return 1})()" >/dev/null 2>&1; sleep 0.4
$B eval "(()=>{const t=[...document.querySelectorAll('.tile')].find(t=>t.querySelector('[data-illustration=\"$N\"]'));t.id='sc';t.scrollIntoView({block:'center'});t.setAttribute('data-live','');t.setAttribute('data-flow','');return 1})()" >/dev/null 2>&1; sleep 0.3
for P in "$@"; do
$B eval "(()=>{for(const el of document.querySelectorAll('#sc *')){for(const a of el.getAnimations()){const d=a.effect.getComputedTiming().duration;a.pause();a.currentTime=d*$P/100;}}return 1})()" >/dev/null 2>&1
$B screenshot "#sc .visual" /tmp/$PF-$P.png >/dev/null 2>&1; done
