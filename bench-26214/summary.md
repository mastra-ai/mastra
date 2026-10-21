| store | items × output | c | variant | runs | writes | bytes written | largest | wall (ms) | disk growth | bytes vs main | wall vs main |
|---|---|---|---|---|---|---|---|---|---|---|---|
| libsql | 1000 × 2KB | 1 | main | 3 | 1003 | 10 MB | 4.05 MB | 431 | 13 MB | 1.00× | 1.00× |
| libsql | 1000 × 2KB | 1 | coalesce | 3 | 5 | 6.09 MB | 4.05 MB | 204 | 13 MB | 0.58× | 0.47× |
| libsql | 1000 × 2KB | 1 | PR as-is | 1 | 2003 | 2055 MB | 4.05 MB | 19564 | 12 MB | 196.88× | 45.39× |
| libsql | 1000 × 2KB | 10 | main | 3 | 1003 | 10 MB | 4.05 MB | 414 | 13 MB | 1.00× | 1.00× |
| libsql | 1000 × 2KB | 10 | coalesce | 3 | 14 | 6.18 MB | 4.05 MB | 153 | 13 MB | 0.59× | 0.37× |
| libsql | 1000 × 2KB | 10 | PR as-is | 1 | 2003 | 2039 MB | 4.05 MB | 21680 | 12 MB | 195.50× | 52.37× |
| libsql | 1000 × 32KB | 1 | main | 3 | 1003 | 100 MB | 64 MB | 1829 | 160 MB | 1.00× | 1.00× |
| libsql | 1000 × 32KB | 1 | coalesce | 3 | 5 | 96 MB | 64 MB | 1639 | 160 MB | 0.96× | 0.90× |
| libsql | 1000 × 32KB | 1 | PR as-is | 1 | DNF: exit 1 | | | | | | |
| libsql | 1000 × 32KB | 10 | main | 3 | 1003 | 100 MB | 64 MB | 1845 | 160 MB | 1.00× | 1.00× |
| libsql | 1000 × 32KB | 10 | coalesce | 3 | 14 | 97 MB | 64 MB | 1575 | 160 MB | 0.96× | 0.85× |
| libsql | 1000 × 32KB | 10 | PR as-is | 1 | DNF: exit 124 | | | | | | |
| libsql | 5000 × 2KB | 1 | main | 4 | 5003 | 152 MB | 20 MB | 3379 | 50 MB | 1.00× | 1.00× |
| libsql | 5000 × 2KB | 1 | coalesce | 4 | 5 | 30 MB | 20 MB | 646 | 50 MB | 0.20× | 0.19× |
| libsql | 5000 × 2KB | 10 | main | 3 | 5003 | 152 MB | 20 MB | 3209 | 50 MB | 1.00× | 1.00× |
| libsql | 5000 × 2KB | 10 | coalesce | 3 | 14 | 31 MB | 20 MB | 632 | 50 MB | 0.20× | 0.20× |
| libsql | 5000 × 32KB | 1 | main | 3 | 5003 | 602 MB | 320 MB | 10784 | 803 MB | 1.00× | 1.00× |
| libsql | 5000 × 32KB | 1 | coalesce | 3 | 5 | 481 MB | 320 MB | 7853 | 803 MB | 0.80× | 0.73× |
| libsql | 5000 × 32KB | 10 | main | 3 | 5003 | 602 MB | 320 MB | 10913 | 803 MB | 1.00× | 1.00× |
| libsql | 5000 × 32KB | 10 | coalesce | 3 | 14 | 481 MB | 320 MB | 8516 | 803 MB | 0.80× | 0.78× |
| libsql | 1000 × 256KB | 1 | main | 3 | 1003 | 772 MB | 512 MB | 13848 | 1285 MB | 1.00× | 1.00× |
| libsql | 1000 × 256KB | 1 | coalesce | 3 | 5 | 768 MB | 512 MB | 13759 | 1285 MB | 0.99× | 0.99× |
| libsql | 1000 × 256KB | 10 | main | 3 | 1003 | 772 MB | 512 MB | 12667 | 1285 MB | 1.00× | 1.00× |
| libsql | 1000 × 256KB | 10 | coalesce | 3 | 14 | 774 MB | 512 MB | 12573 | 1285 MB | 1.00× | 0.99× |
| pg | 1000 × 2KB | 1 | main | 3 | 1003 | 10 MB | 4.05 MB | 3413 | 4.39 MB | 1.00× | 1.00× |
| pg | 1000 × 2KB | 1 | coalesce | 3 | 5 | 6.09 MB | 4.05 MB | 190 | 0.24 MB | 0.58× | 0.06× |
| pg | 1000 × 2KB | 10 | main | 3 | 1003 | 10 MB | 4.05 MB | 1818 | 4.38 MB | 1.00× | 1.00× |
| pg | 1000 × 2KB | 10 | coalesce | 3 | 14 | 8.16 MB | 4.05 MB | 300 | 0.30 MB | 0.78× | 0.17× |
| pg | 1000 × 32KB | 1 | main | 3 | 1003 | 100 MB | 64 MB | 4890 | 5.59 MB | 1.00× | 1.00× |
| pg | 1000 × 32KB | 1 | coalesce | 3 | 5 | 96 MB | 64 MB | 2038 | 1.43 MB | 0.96× | 0.42× |
| pg | 1000 × 32KB | 10 | main | 3 | 1003 | 100 MB | 64 MB | 3749 | 5.60 MB | 1.00× | 1.00× |
| pg | 1000 × 32KB | 10 | coalesce | 3 | 14 | 128 MB | 64 MB | 2638 | 1.93 MB | 1.28× | 0.70× |
| pg | 5000 × 2KB | 1 | main | 3 | 5003 | 152 MB | 20 MB | 49855 | 73 MB | 1.00× | 1.00× |
| pg | 5000 × 2KB | 1 | coalesce | 3 | 5 | 30 MB | 20 MB | 858 | 0.70 MB | 0.20× | 0.02× |
| pg | 5000 × 2KB | 10 | main | 3 | 5003 | 152 MB | 20 MB | 45507 | 78 MB | 1.00× | 1.00× |
| pg | 5000 × 2KB | 10 | coalesce | 3 | 14 | 41 MB | 20 MB | 1066 | 1.05 MB | 0.27× | 0.02× |
| pg | 5000 × 32KB | 1 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 5000 × 32KB | 1 | coalesce | 1 | DNF: exit 1 | | | | | | |
| pg | 5000 × 32KB | 10 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 5000 × 32KB | 10 | coalesce | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 1 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 1 | coalesce | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 10 | main | 1 | DNF: exit 1 | | | | | | |
| pg | 1000 × 256KB | 10 | coalesce | 1 | DNF: exit 1 | | | | | | |
