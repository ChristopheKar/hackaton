#!/bin/bash

imgname=hackaton

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help) help=1 ;;
        -s|--shell) shell=1 ;;
        -b|--build) build=1 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Show help and exit
if [[ "$help" -eq 1 ]]; then
    echo "usage: run.sh [-h/--help] [-s/--shell] [-b/--build] [-r/--as-root] [-n/--name NAME] [-in/--img-name IMAGENAME]"
    echo "  -h/--help: show this help message and exit"
    echo "  -s/--shell: run container with shell as entrypoint"
    echo "  -b/--build: build image before running container"
    exit 0
fi

# Build image if --build is specified or if it does not exist locally
# Inspect image and check if exit code is 0
docker inspect "$imgname" > /dev/null 2>&1
status="$?"
if [[ "$build" -eq 1 ]] || [[ "$status" != 0 ]]; then
    echo "Building image..."

    # Set build context
    if [ -z ${context+x} ]; then
        context="."
    fi

    docker build -t $imgname "$context"
fi

# Set entrypoint as shell
if [[ "$shell" -eq 1 ]]; then
    entrypoint="--entrypoint /bin/bash"
fi


# Run container
docker run \
  -it --rm \
  -v $PWD:/usr/src/app \
  -p 8080:8080 \
  --name $imgname \
  $entrypoint \
  $imgname
