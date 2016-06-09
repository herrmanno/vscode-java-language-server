OUT=classes

mkdir -p $OUT
find src | grep -e "\.java" | xargs javac -d classes
